package com.sdoc.sdoc.service.auth;

import com.sdoc.sdoc.api.dto.AuthResponseDto;
import com.sdoc.sdoc.api.dto.LoginRequestDto;
import com.sdoc.sdoc.api.dto.RegisterRequestDto;
import com.sdoc.sdoc.api.dto.UserDataDto;
import com.sdoc.sdoc.persistance.entity.RefreshToken;
import com.sdoc.sdoc.persistance.entity.User;
import com.sdoc.sdoc.persistance.repository.RefreshTokenRepository;
import com.sdoc.sdoc.persistance.repository.UserRepository;
import com.sdoc.sdoc.service.RateLimitService;
import com.sdoc.sdoc.service.auth.oauth.OAuthProvider;
import com.sdoc.sdoc.service.auth.oauth.OAuthProviderRegistry;
import com.sdoc.sdoc.service.tokens.TokenRevocationService;
import com.sdoc.sdoc.service.validation.InputValidationService;
import jakarta.annotation.PostConstruct;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class AuthService {
    private static final String BEARER_PREFIX = "Bearer ";
    private static final String REFRESH_COOKIE_PATH = "/api/v1/auth";
    private static final long REFRESH_TOKEN_DAYS_WEB = 30;
    private static final long REFRESH_TOKEN_DAYS_NATIVE = 180;
    private static final int MAX_PASSWORD_LENGTH = 72;

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final BCryptPasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final TokenRevocationService tokenRevocationService;
    private final InputValidationService inputValidationService;
    private final RateLimitService rateLimitService;
    private final OAuthProviderRegistry oauthProviderRegistry;

    @Value("${auth.cookie.access.name}")
    private String accessCookieName;

    @Value("${auth.cookie.refresh.name}")
    private String refreshCookieName;

    @Value("${auth.cookie.secure}")
    private boolean secureCookies;

    @Value("${auth.cookie.same-site}")
    private String sameSite;

    // Compared against when the email is unknown, so response time doesn't reveal which emails exist.
    private String dummyHash;

    @PostConstruct
    void init() {
        dummyHash = passwordEncoder.encode(UUID.randomUUID().toString());
    }

    public AuthResponseDto register(RegisterRequestDto dto, boolean nativeClient) {
        String email = normalizeEmail(dto.getEmail());
        String fullName = dto.getFullName() == null ? null : dto.getFullName().trim();
        requireValid(inputValidationService.validateEmail(email));
        requireValid(inputValidationService.validateFullName(fullName));
        requireValid(inputValidationService.validatePassword(dto.getPassword()));

        userRepository.findByEmail(email).ifPresent(existing -> {
            if ("google".equals(existing.getOauthProvider()))
                throw new ResponseStatusException(HttpStatus.CONFLICT, "This email is already registered with Google.");
            throw emailTaken();
        });

        User user = new User();
        user.setFullName(fullName);
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(dto.getPassword()));
        user.setIsAdmin(false);
        try {
            user = userRepository.saveAndFlush(user);
        } catch (DataIntegrityViolationException ex) {
            throw emailTaken();
        }
        return generateTokens(user, nativeClient);
    }

    public AuthResponseDto login(LoginRequestDto dto, String clientIp, boolean nativeClient) {
        String email = normalizeEmail(dto.getEmail());
        String password = dto.getPassword();
        if (email == null || email.isEmpty() || password == null || password.length() > MAX_PASSWORD_LENGTH)
            throw invalidCredentials();

        String loginKey = "login:" + clientIp + ":" + email;
        rateLimitService.checkLoginLockout(loginKey);

        User user = userRepository.findByEmail(email).orElse(null);
        if (user != null && "google".equals(user.getOauthProvider()))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This email is already registered with Google.");
        boolean passwordMatches = passwordEncoder.matches(password, user != null ? user.getPasswordHash() : dummyHash);
        if (user == null || !passwordMatches) {
            rateLimitService.recordFailedLogin(loginKey);
            throw invalidCredentials();
        }

        rateLimitService.resetFailedLogin(loginKey);
        return generateTokens(user, nativeClient);
    }

    @Transactional(noRollbackFor = ResponseStatusException.class)
    public AuthResponseDto refresh(String refreshToken, boolean nativeClient) {
        User user = jwtService.validateRefreshToken(refreshToken);
        return generateTokens(user, nativeClient);
    }

    public void logout(Long userId, String accessToken) {
        List<RefreshToken> activeTokens = refreshTokenRepository.findAllByUserAndRevokedAtIsNull(userRepository.getReferenceById(userId));
        Instant now = Instant.now();
        activeTokens.forEach(t -> t.setRevokedAt(now));
        refreshTokenRepository.saveAll(activeTokens);
        if (accessToken != null)
            tokenRevocationService.revokeAccessToken(accessToken);
    }

    public AuthResponseDto loginWithOAuth(String accessToken, OAuthProvider provider, boolean nativeClient) {
        UserDataDto oauthUser = provider.fetchUserInfo(accessToken);
        String providerName = provider.getProviderName();

        User user = userRepository.findByEmail(oauthUser.getEmail()).map(existing -> {
            if (existing.getOauthProvider() == null)
                throw new ResponseStatusException(HttpStatus.CONFLICT, "This email is already registered with password login.");
            if (!providerName.equals(existing.getOauthProvider()))
                throw new ResponseStatusException(HttpStatus.CONFLICT, "This email is registered with a different OAuth provider.");
            return existing;
        }).orElseGet(() -> createOAuthUser(oauthUser, providerName));

        return generateTokens(user, nativeClient);
    }

    public AuthResponseDto loginWithAuthCode(String providerName, String tokenOrCode, String redirectUri, boolean nativeClient) {
        // Strategy Design Pattern
        OAuthProvider provider = oauthProviderRegistry.getProvider(providerName);
        // Native app provides access token directly, web client provides auth code that needs to be exchanged
        String accessToken = (tokenOrCode != null && tokenOrCode.startsWith("ya29.")) ? tokenOrCode : provider.exchangeAuthCodeForAccessToken(tokenOrCode, redirectUri);
        return loginWithOAuth(accessToken, provider, nativeClient);
    }

    private User createOAuthUser(UserDataDto info, String providerName) {
        User user = new User();
        user.setEmail(info.getEmail());
        user.setFullName(info.getFullName());
        user.setPasswordHash(passwordEncoder.encode(UUID.randomUUID().toString()));
        user.setIsAdmin(false);
        user.setOauthProvider(providerName);

        return userRepository.save(user);
    }

    private AuthResponseDto generateTokens(User user, boolean nativeClient) {
        String accessToken = jwtService.generateAccessToken(user);
        String refreshToken = jwtService.generateRefreshToken(user, nativeClient ? REFRESH_TOKEN_DAYS_NATIVE : REFRESH_TOKEN_DAYS_WEB);
        return new AuthResponseDto(accessToken, refreshToken);
    }

    private static String normalizeEmail(String email) {
        return email == null ? null : email.trim().toLowerCase(Locale.ROOT);
    }

    private static void requireValid(String validationError) {
        if (validationError != null)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, validationError);
    }

    private static ResponseStatusException emailTaken() {
        return new ResponseStatusException(HttpStatus.CONFLICT, "This email address is already registered.");
    }

    private static ResponseStatusException invalidCredentials() {
        return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password.");
    }

    public void setAuthCookies(HttpServletResponse response, AuthResponseDto tokens) {
        addCookie(response, accessCookieName, tokens.getAccessToken(), "/", JwtService.ACCESS_TOKEN_TTL);
        addCookie(response, refreshCookieName, tokens.getRefreshToken(), REFRESH_COOKIE_PATH, Duration.ofDays(REFRESH_TOKEN_DAYS_WEB));
    }

    public void clearAuthCookies(HttpServletResponse response) {
        addCookie(response, accessCookieName, "", "/", Duration.ZERO);
        addCookie(response, refreshCookieName, "", REFRESH_COOKIE_PATH, Duration.ZERO);
    }

    private void addCookie(HttpServletResponse response, String name, String value, String path, Duration maxAge) {
        ResponseCookie cookie = ResponseCookie.from(name, value)
                .httpOnly(true).secure(secureCookies).sameSite(sameSite).path(path).maxAge(maxAge).build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    public String resolveAccessToken(HttpServletRequest request) {
        String authHeader = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (authHeader != null && authHeader.startsWith(BEARER_PREFIX))
            return authHeader.substring(BEARER_PREFIX.length());
        return getCookieValue(request, accessCookieName);
    }

    public String resolveRefreshToken(HttpServletRequest request) {
        return getCookieValue(request, refreshCookieName);
    }

    private static String getCookieValue(HttpServletRequest request, String cookieName) {
        if (request.getCookies() == null) return null;
        for (var cookie : request.getCookies()) {
            if (cookieName.equals(cookie.getName()))
                return cookie.getValue();
        }
        return null;
    }
}
