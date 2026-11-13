package com.sdoc.sdoc.service.tokens;

import com.sdoc.sdoc.persistance.repository.RefreshTokenRepository;
import lombok.AllArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;

@Service
@AllArgsConstructor
public class TokenCleanupService {
    private static final Duration ROTATED_RETENTION = Duration.ofDays(1);
    private final RefreshTokenRepository refreshTokenRepository;

    @Scheduled(cron = "0 0 * * * *")
    public void cleanupStaleTokens() {
        Instant now = Instant.now();
        refreshTokenRepository.deleteStale(now, now.minus(ROTATED_RETENTION));
    }
}
