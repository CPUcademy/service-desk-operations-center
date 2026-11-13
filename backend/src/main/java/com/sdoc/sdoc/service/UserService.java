package com.sdoc.sdoc.service;

import com.sdoc.sdoc.persistance.entity.User;
import com.sdoc.sdoc.persistance.repository.RefreshTokenRepository;
import com.sdoc.sdoc.persistance.repository.UserRepository;
import com.sdoc.sdoc.service.auth.oauth.OAuthProvider;
import com.sdoc.sdoc.service.auth.oauth.OAuthProviderRegistry;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class UserService {
    private static final int MAX_PASSWORD_LENGTH = 72;

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final BCryptPasswordEncoder passwordEncoder;
    private final RateLimitService rateLimitService;
    private final OAuthProviderRegistry oauthProviderRegistry;

    public void deleteAccount(Long userId, Map<String, String> body) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Session expired. Please sign in again."));
        String key = "delete:" + userId;
        rateLimitService.checkLoginLockout(key);
        if (!reauthenticated(user, body)) {
            rateLimitService.recordFailedLogin(key, 2);
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Re-authentication failed");
        }
        refreshTokenRepository.deleteByUserId(userId);
        userRepository.delete(user);
    }

    private boolean reauthenticated(User user, Map<String, String> body) {
        if (user.getOauthProvider() == null) {
            String password = body.get("password");
            return password != null && password.length() <= MAX_PASSWORD_LENGTH && passwordEncoder.matches(password, user.getPasswordHash());
        }
        String code = body.get("code");
        if (code == null || code.isBlank())
            return false;
        OAuthProvider provider = oauthProviderRegistry.getProvider(user.getOauthProvider());
        String email = provider.fetchUserInfo(provider.exchangeAuthCodeForAccessToken(code, body.get("redirectUri"))).getEmail();
        return user.getEmail().equals(email);
    }
}
