package com.sdoc.sdoc.service.tokens;

import com.sdoc.sdoc.service.auth.JwtService;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class TokenRevocationService {
    private static final String REVOKED_ACCESS_PREFIX = "revoked:access:";
    private final Map<String, Instant> revokedTokens = new ConcurrentHashMap<>();
    private final Map<Long, Instant> revokedUsers = new ConcurrentHashMap<>();
    private final JwtService jwtService;

    public TokenRevocationService(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    public void revokeAccessToken(String token) {
        Instant expiry = jwtService.getAccessTokenExpiry(token);
        Instant now = Instant.now();
        if (!expiry.isAfter(now))
            return;

        String key = REVOKED_ACCESS_PREFIX + sha256Hex(token);
        revokedTokens.put(key, expiry);
    }

    public void revokeUser(Long userId) {
        revokedUsers.put(userId, Instant.now().plus(JwtService.ACCESS_TOKEN_TTL));
    }

    public boolean isUserRevoked(Long userId) {
        Instant until = revokedUsers.get(userId);
        return until != null && until.isAfter(Instant.now());
    }

    public boolean isAccessTokenRevoked(String token) {
        cleanupExpiredEntries();
        String key = REVOKED_ACCESS_PREFIX + sha256Hex(token);
        Instant expiry = revokedTokens.get(key);
        return expiry != null && expiry.isAfter(Instant.now());
    }

    private void cleanupExpiredEntries() {
        Instant now = Instant.now();
        revokedTokens.entrySet().removeIf(entry -> !entry.getValue().isAfter(now));
        revokedUsers.entrySet().removeIf(entry -> !entry.getValue().isAfter(now));
    }

    private static String sha256Hex(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(token.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(hash.length * 2);
            for (byte b : hash)
                hex.append(String.format("%02x", b));
            return hex.toString();
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to hash token", ex);
        }
    }
}
