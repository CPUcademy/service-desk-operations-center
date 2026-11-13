package com.sdoc.sdoc.service.tokens;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.sdoc.sdoc.service.auth.JwtService;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

@Service
public class TokenRevocationService {
    private static final long MAX_ENTRIES = 100_000;
    private final Cache<String, Boolean> revokedTokens = Caffeine.newBuilder()
            .expireAfterWrite(JwtService.ACCESS_TOKEN_TTL).maximumSize(MAX_ENTRIES).build();
    private final Cache<Long, Instant> revokedUsers = Caffeine.newBuilder()
            .expireAfterWrite(JwtService.ACCESS_TOKEN_TTL).maximumSize(MAX_ENTRIES).build();

    public void revokeAccessToken(String token) {
        revokedTokens.put(JwtService.sha256(token), true);
    }

    // Revokes access tokens issued before now; truncated because JWT iat has second precision.
    public void revokeUser(Long userId) {
        revokedUsers.put(userId, Instant.now().truncatedTo(ChronoUnit.SECONDS));
    }

    public boolean isUserRevoked(Long userId, Instant issuedAt) {
        Instant revokedAt = revokedUsers.getIfPresent(userId);
        return revokedAt != null && issuedAt.isBefore(revokedAt);
    }

    public boolean isAccessTokenRevoked(String token) {
        return revokedTokens.getIfPresent(JwtService.sha256(token)) != null;
    }
}
