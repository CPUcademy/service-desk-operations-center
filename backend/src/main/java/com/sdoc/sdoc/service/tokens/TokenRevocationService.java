package com.sdoc.sdoc.service.tokens;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.sdoc.sdoc.service.auth.JwtService;
import org.springframework.stereotype.Service;

@Service
public class TokenRevocationService {
    private static final long MAX_ENTRIES = 100_000;
    private final Cache<String, Boolean> revokedTokens = Caffeine.newBuilder()
            .expireAfterWrite(JwtService.ACCESS_TOKEN_TTL).maximumSize(MAX_ENTRIES).build();
    private final Cache<Long, Boolean> revokedUsers = Caffeine.newBuilder()
            .expireAfterWrite(JwtService.ACCESS_TOKEN_TTL).maximumSize(MAX_ENTRIES).build();

    public void revokeAccessToken(String token) {
        revokedTokens.put(JwtService.sha256(token), true);
    }

    public void revokeUser(Long userId) {
        revokedUsers.put(userId, true);
    }

    public boolean isUserRevoked(Long userId) {
        return revokedUsers.getIfPresent(userId) != null;
    }

    public boolean isAccessTokenRevoked(String token) {
        return revokedTokens.getIfPresent(JwtService.sha256(token)) != null;
    }
}
