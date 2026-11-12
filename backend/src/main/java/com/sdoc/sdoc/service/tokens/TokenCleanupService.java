package com.sdoc.sdoc.service.tokens;

import com.sdoc.sdoc.persistance.entity.RefreshToken;
import com.sdoc.sdoc.persistance.repository.RefreshTokenRepository;
import lombok.AllArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
@AllArgsConstructor
public class TokenCleanupService {
    private final RefreshTokenRepository refreshTokenRepository;

    // Runs every hour
    @Scheduled(cron = "0 0 * * * *")
    @Transactional
    public void cleanupExpiredTokens() {
        Instant now = Instant.now();
        List<RefreshToken> expiredTokens = refreshTokenRepository.findAllByExpiresAtBefore(now);
        if (!expiredTokens.isEmpty())
            refreshTokenRepository.deleteAll(expiredTokens);
    }
}
