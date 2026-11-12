package com.sdoc.sdoc.service;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.util.concurrent.atomic.AtomicInteger;

// ponytail: in-memory per instance, move to Redis/bucket4j if running more than one instance
@Service
public class RateLimitService {
    private static final long MAX_KEYS = 100_000;
    private final Cache<String, AtomicInteger> requestWindows = Caffeine.newBuilder()
            .expireAfterWrite(Duration.ofMinutes(1)).maximumSize(MAX_KEYS).build();
    private final Cache<String, AtomicInteger> loginFailures = Caffeine.newBuilder()
            .expireAfterWrite(Duration.ofHours(1)).maximumSize(MAX_KEYS).build();
    private final Cache<String, Long> loginLockouts = Caffeine.newBuilder()
            .expireAfterWrite(Duration.ofMinutes(10)).maximumSize(MAX_KEYS).build();

    public boolean tryAcquire(String key, int limitPerMinute) {
        return requestWindows.get(key, k -> new AtomicInteger()).incrementAndGet() <= limitPerMinute;
    }

    public void checkLoginLockout(String loginKey) {
        Long until = loginLockouts.getIfPresent(loginKey);
        long remaining = until == null ? 0 : (until - System.currentTimeMillis()) / 1000;
        if (remaining > 0)
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Too many failed login attempts. Please try again in " + remaining + " seconds.");
    }

    public void recordFailedLogin(String loginKey) {
        int fails = loginFailures.get(loginKey, k -> new AtomicInteger()).incrementAndGet();
        long delayMs = switch (fails) {
            case 1, 2 -> 0;
            case 3 -> 60_000;
            case 4 -> 120_000;
            case 5 -> 300_000;
            default -> 600_000;
        };
        if (delayMs > 0)
            loginLockouts.put(loginKey, System.currentTimeMillis() + delayMs);
    }

    public void resetFailedLogin(String loginKey) {
        loginFailures.invalidate(loginKey);
        loginLockouts.invalidate(loginKey);
    }
}
