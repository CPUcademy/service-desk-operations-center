package com.sdoc.sdoc.service.auth;

import com.sdoc.sdoc.persistance.entity.RefreshToken;
import com.sdoc.sdoc.persistance.entity.User;
import com.sdoc.sdoc.persistance.repository.RefreshTokenRepository;
import com.sdoc.sdoc.security.JwtClaim;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
public class JwtService {
    public static final Duration ACCESS_TOKEN_TTL = Duration.ofMinutes(15);
    private static final String TOKEN_TYPE_ACCESS = "access";
    private final String issuer = "sdoc";
    private final String audience = "sdoc-client";

    @Value("${jwt.secret}")
    private String jwtSecret;

    private final RefreshTokenRepository refreshTokenRepository;
    private final BCryptPasswordEncoder  passwordEncoder;

    public JwtService(RefreshTokenRepository refreshTokenRepository, BCryptPasswordEncoder passwordEncoder) {
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordEncoder = passwordEncoder;
    }

    private Key signingKey() {
        byte[] bytes = jwtSecret.getBytes(StandardCharsets.UTF_8);
        if (bytes.length < 32)
            throw new IllegalStateException("JWT secret must be at least 256 bits (32 bytes)");
        return Keys.hmacShaKeyFor(bytes);
    }

    public String generateAccessToken(User user) {
        Instant now = Instant.now();
        Instant expiry = now.plus(ACCESS_TOKEN_TTL);
        return Jwts.builder().subject(user.getId().toString()).issuer(issuer).audience()
                .add(audience).and().claim("isAdmin", user.getIsAdmin())
                .claim("type", TOKEN_TYPE_ACCESS).issuedAt(Date.from(now))
                .expiration(Date.from(expiry)).signWith(signingKey()).compact();
    }

    public JwtClaim validateAccessToken(String token) {
        try {
            Claims claims = Jwts.parser().verifyWith((javax.crypto.SecretKey) signingKey())
                    .requireIssuer(issuer).requireAudience(audience).build().parseSignedClaims(token).getPayload();
            String type = claims.get("type", String.class);
            if (!TOKEN_TYPE_ACCESS.equals(type))
                throw new IllegalArgumentException("Invalid token");
            String subject = claims.getSubject();
            if (subject == null)
                throw new IllegalArgumentException("Invalid token");

            Long userId = Long.parseLong(subject);
            Boolean isAdmin = claims.get("isAdmin", Boolean.class);
            return new JwtClaim(userId, Boolean.TRUE.equals(isAdmin));
        } catch (JwtException | IllegalArgumentException ex) {
            throw new IllegalArgumentException("Session expired. Please sign in again.");
        }
    }

    public Instant getAccessTokenExpiry(String token) {
        try {
            Claims claims = Jwts.parser().verifyWith((javax.crypto.SecretKey) signingKey())
                    .requireIssuer(issuer).requireAudience(audience).build().parseSignedClaims(token).getPayload();
            String type = claims.get("type", String.class);
            if (!TOKEN_TYPE_ACCESS.equals(type))
                throw new IllegalArgumentException("Invalid token");
            Date expiration = claims.getExpiration();
            return expiration != null ? expiration.toInstant() : Instant.now();
        } catch (JwtException | IllegalArgumentException ex) {
            throw new IllegalArgumentException("Session expired. Please sign in again.");
        }
    }

    public String generateRefreshToken(User user, long refreshTokenDays) {
        String tokenId = UUID.randomUUID().toString();
        String rawSecret = UUID.randomUUID().toString();
        RefreshToken entity = new RefreshToken();
        entity.setUser(user);
        entity.setTokenId(tokenId);
        entity.setTokenHash(passwordEncoder.encode(rawSecret));
        entity.setExpiresAt(Instant.now().plus(refreshTokenDays, ChronoUnit.DAYS));

        refreshTokenRepository.save(entity);
        return tokenId + "." + rawSecret;
    }

    @Transactional(noRollbackFor = ResponseStatusException.class)
    public User validateRefreshToken(String rawToken) {
        String[] parts = rawToken.split("\\.", 2);
        if (parts.length != 2)
            throw invalidSession();

        String tokenId = parts[0];
        String rawSecret = parts[1];
        Instant now = Instant.now();
        RefreshToken refreshToken = refreshTokenRepository.findByTokenId(tokenId).orElse(null);
        if (refreshToken == null) {
            log.warn("Refresh token not found: {}", tokenId);
            throw invalidSession();
        }

        if (refreshToken.getRevokedAt() != null) {
            revokeAllSessionsFor(refreshToken.getUser(), now);
            log.warn("Refresh token reuse detected for tokenId: {}", tokenId);
            throw invalidSession();
        }
        if (refreshToken.getExpiresAt().isBefore(now))
            throw invalidSession();
        if (!passwordEncoder.matches(rawSecret, refreshToken.getTokenHash())) {
            log.warn("Refresh token secret mismatch for tokenId: {}", tokenId);
            throw invalidSession();
        }

        refreshToken.setRevokedAt(now);
        refreshTokenRepository.save(refreshToken);
        return refreshToken.getUser();
    }

    public User findRefreshTokenOwner(String rawToken) {
        String[] parts = rawToken.split("\\.", 2);
        if (parts.length != 2)
            return null;
        return refreshTokenRepository.findByTokenId(parts[0])
                .filter(t -> passwordEncoder.matches(parts[1], t.getTokenHash()))
                .map(RefreshToken::getUser).orElse(null);
    }

    private static ResponseStatusException invalidSession() {
        return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Session expired. Please sign in again.");
    }

    private void revokeAllSessionsFor(User user, Instant at) {
        List<RefreshToken> tokens = refreshTokenRepository.findAllByUser(user);
        tokens.stream().filter(t -> t.getRevokedAt() == null).forEach(t -> t.setRevokedAt(at));
        refreshTokenRepository.saveAll(tokens);
    }
}