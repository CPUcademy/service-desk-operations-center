package com.sdoc.sdoc.service;

import com.sdoc.sdoc.api.dto.UserDataDto;
import com.sdoc.sdoc.persistance.entity.User;
import com.sdoc.sdoc.persistance.repository.RefreshTokenRepository;
import com.sdoc.sdoc.persistance.repository.UserRepository;
import com.sdoc.sdoc.service.auth.oauth.OAuthProvider;
import com.sdoc.sdoc.service.auth.oauth.OAuthProviderRegistry;
import com.sdoc.sdoc.service.validation.InputValidationService;
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
    private final InputValidationService inputValidationService;

    public UserDataDto getProfile(Long userId) {
        User user = findUser(userId);
        return new UserDataDto(user.getId(), user.getFullName(), user.getEmail(), user.getIsAdmin(), user.getOauthProvider());
    }

    public void deleteAccount(Long userId, Map<String, String> body) {
        User user = findUser(userId);
        requireReauthenticated(user, body);
        refreshTokenRepository.deleteByUserId(userId);
        userRepository.delete(user);
    }

    public User changePassword(Long userId, Map<String, String> body) {
        User user = findUser(userId);
        if (user.getOauthProvider() != null)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password is managed by your sign-in provider.");
        String newPassword = body.get("newPassword");
        String validationError = inputValidationService.validatePassword(newPassword);
        if (validationError != null)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, validationError);
        requireReauthenticated(user, body);
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user = userRepository.save(user);
        refreshTokenRepository.deleteByUserId(userId);
        return user;
    }

    private User findUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Session expired. Please sign in again."));
    }

    private void requireReauthenticated(User user, Map<String, String> body) {
        String key = "reauth:" + user.getId();
        rateLimitService.checkLoginLockout(key);
        if (!reauthenticated(user, body)) {
            rateLimitService.recordFailedLogin(key, 2);
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Re-authentication failed");
        }
        rateLimitService.resetFailedLogin(key);
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
