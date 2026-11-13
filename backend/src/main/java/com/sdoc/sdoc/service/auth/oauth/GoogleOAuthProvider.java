package com.sdoc.sdoc.service.auth.oauth;

import com.sdoc.sdoc.api.dto.UserDataDto;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.net.URLEncoder;
import java.net.http.*;
import java.net.URI;
import java.nio.charset.StandardCharsets;

@Slf4j
@Service
public class GoogleOAuthProvider implements OAuthProvider {
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final HttpClient HTTP_CLIENT = HttpClient.newBuilder().connectTimeout(java.time.Duration.ofSeconds(12)).build();

    @Value("${spring.security.oauth2.client.registration.google.client-id}")
    private String clientId;

    @Value("${spring.security.oauth2.client.registration.google.client-secret}")
    private String clientSecret;

    @Value("${oauth.google.default-redirect-uri}")
    private String defaultRedirectUri;

    @Override
    public UserDataDto fetchUserInfo(String accessToken) {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://www.googleapis.com/oauth2/v3/userinfo"))
                    .header("Authorization", "Bearer " + accessToken)
                    .timeout(java.time.Duration.ofSeconds(12)).GET().build();
            HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200)
                throw new IllegalArgumentException("Google rejected the access token (HTTP " + response.statusCode() + ").");
            JsonNode node = OBJECT_MAPPER.readTree(response.body());
            JsonNode emailNode = node.get("email");
            if (emailNode == null || emailNode.stringValue().isBlank())
                throw new IllegalArgumentException("Google account did not return an email address. Ensure the 'email' scope is granted.");
            if (!node.path("email_verified").asBoolean(false))
                throw new IllegalArgumentException("Google account email is not verified.");
            String email = emailNode.stringValue().trim().toLowerCase(java.util.Locale.ROOT);
            JsonNode nameNode = node.path("name");
            String name = nameNode.isString() && !nameNode.stringValue().isBlank() ? nameNode.stringValue() : email.split("@")[0];
            return new UserDataDto(email, name);
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            log.error("Unexpected error fetching Google user info", e);
            throw new RuntimeException("Could not reach Google authentication servers. Please try again.");
        }
    }

    public String exchangeAuthCodeForAccessToken(String authCode, String redirectUri) {
        try {
            validateOAuthConfiguration();
            String effectiveRedirectUri = (redirectUri == null || redirectUri.isBlank()) ? defaultRedirectUri : redirectUri;
            String body = "code=" + encode(authCode) + "&client_id=" + encode(clientId) + "&client_secret=" + encode(clientSecret)
                    + "&redirect_uri=" + encode(effectiveRedirectUri) + "&grant_type=authorization_code";
            HttpRequest request = HttpRequest.newBuilder().uri(URI.create("https://oauth2.googleapis.com/token"))
                    .header("Content-Type", "application/x-www-form-urlencoded")
                    .timeout(java.time.Duration.ofSeconds(12)).POST(HttpRequest.BodyPublishers.ofString(body)).build();

            HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                String googleError = extractGoogleError(response.body());
                throw new IllegalArgumentException("Google authorization code exchange failed: " + googleError);
            }

            JsonNode node = OBJECT_MAPPER.readTree(response.body());
            JsonNode accessTokenNode = node.get("access_token");
            if (accessTokenNode == null || accessTokenNode.stringValue().isBlank()) {
                throw new IllegalArgumentException("Google token exchange returned no access token");
            }
            return accessTokenNode.stringValue();
        } catch (IllegalArgumentException | IllegalStateException e) {
            throw e;
        } catch (Exception e) {
            log.error("Unexpected error during Google authorization code exchange", e);
            throw new RuntimeException("Could not reach Google authentication servers. Please try again.");
        }
    }

    private String extractGoogleError(String responseBody) {
        try {
            JsonNode node = OBJECT_MAPPER.readTree(responseBody);
            String error = node.has("error") ? node.get("error").stringValue() : null;
            String desc = node.has("error_description") ? node.get("error_description").stringValue() : null;
            if (desc != null && !desc.isBlank()) return desc;
            if (error != null && !error.isBlank()) return error;
        } catch (Exception ignored) {}
        return "unknown error";
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private void validateOAuthConfiguration() {
        if (clientId == null || clientId.isBlank() || clientSecret == null || clientSecret.isBlank())
            throw new IllegalStateException("Google OAuth is not configured on backend");
    }

    @Override
    public String getProviderName() {
        return "google";
    }
}
