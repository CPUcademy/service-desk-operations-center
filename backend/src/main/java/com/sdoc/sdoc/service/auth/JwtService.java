package com.sdoc.sdoc.service.auth;

import com.sdoc.sdoc.persistance.entity.RefreshToken;
import com.sdoc.sdoc.persistance.entity.User;
import com.sdoc.sdoc.persistance.repository.RefreshTokenRepository;
import com.sdoc.sdoc.security.JwtClaim;
import com.sdoc.sdoc.service.tokens.TokenRevocationService;
import jakarta.annotation.PostConstruct;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import javax.crypto.SecretKey;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
public class JwtService {
    public static final Duration ACCESS_TOKEN_TTL = Duration.ofMinutes(15);
    private static final Duration ROTATION_GRACE = Duration.ofSeconds(30);
    private static final String TOKEN_TYPE_ACCESS = "access";
    private final String issuer = "sdoc";
    private final String audience = "sdoc-client";

    @Value("${jwt.secret}")
    private String jwtSecret;

    private final RefreshTokenRepository refreshTokenRepository;
    private final TokenRevocationService tokenRevocationService;
    private SecretKey signingKey;

    public JwtService(RefreshTokenRepository refreshTokenRepository, TokenRevocationService tokenRevocationService) {
        this.refreshTokenRepository = refreshTokenRepository;
        this.tokenRevocationService = tokenRevocationService;
    }

    @PostConstruct
    void init() {
        byte[] bytes = jwtSecret.getBytes(StandardCharsets.UTF_8);
        if (bytes.length < 32)
            throw new IllegalStateException("JWT secret must be at least 256 bits (32 bytes)");
        signingKey = Keys.hmacShaKeyFor(bytes);
    }

    public static String sha256(String value) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(hash);
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException(ex);
        }
    }

    private static boolean secretMatches(String rawSecret, String storedHash) {
        return MessageDigest.isEqual(sha256(rawSecret).getBytes(StandardCharsets.UTF_8), storedHash.getBytes(StandardCharsets.UTF_8));
    }

    public String generateAccessToken(User user) {
        Instant now = Instant.now();
        Instant expiry = now.plus(ACCESS_TOKEN_TTL);
        return Jwts.builder().subject(user.getId().toString()).issuer(issuer).audience()
                .add(audience).and().claim("isAdmin", user.getIsAdmin())
                .claim("type", TOKEN_TYPE_ACCESS).issuedAt(Date.from(now))
                .expiration(Date.from(expiry)).signWith(signingKey).compact();
    }

    public JwtClaim validateAccessToken(String token) {
        try {
            Claims claims = Jwts.parser().verifyWith(signingKey)
                    .requireIssuer(issuer).requireAudience(audience).build().parseSignedClaims(token).getPayload();
            String type = claims.get("type", String.class);
            if (!TOKEN_TYPE_ACCESS.equals(type))
                throw new IllegalArgumentException("Invalid token");
            String subject = claims.getSubject();
            if (subject == null)
                throw new IllegalArgumentException("Invalid token");

            Long userId = Long.parseLong(subject);
            Boolean isAdmin = claims.get("isAdmin", Boolean.class);
            if (claims.getIssuedAt() == null)
                throw new IllegalArgumentException("Invalid token");
            return new JwtClaim(userId, Boolean.TRUE.equals(isAdmin), claims.getIssuedAt().toInstant());
        } catch (JwtException | IllegalArgumentException ex) {
            throw new IllegalArgumentException("Session expired. Please sign in again.");
        }
    }

    public String generateRefreshToken(User user, Instant expiresAt) {
        String tokenId = UUID.randomUUID().toString();
        String rawSecret = UUID.randomUUID().toString();
        RefreshToken entity = new RefreshToken();
        entity.setUser(user);
        entity.setTokenId(tokenId);
        entity.setTokenHash(sha256(rawSecret));
        entity.setExpiresAt(expiresAt);

        refreshTokenRepository.save(entity);
        return tokenId + "." + rawSecret;
    }

    @Transactional(noRollbackFor = ResponseStatusException.class)
    public RefreshToken validateRefreshToken(String rawToken) {
        String[] parts = rawToken.split("\\.", 2);
        if (parts.length != 2)
            throw invalidSession();

        String tokenId = parts[0];
        Instant now = Instant.now();
        RefreshToken refreshToken = refreshTokenRepository.findByTokenId(tokenId).orElse(null);
        if (refreshToken == null || !secretMatches(parts[1], refreshToken.getTokenHash())) {
            log.warn("Invalid refresh token: {}", tokenId);
            throw invalidSession();
        }
        if (refreshToken.getExpiresAt().isBefore(now))
            throw invalidSession();

        if (refreshToken.getRevokedAt() != null) {
            if (refreshToken.getRevokedAt().isAfter(now.minus(ROTATION_GRACE)))
                return refreshToken;
            refreshTokenRepository.deleteByUserId(refreshToken.getUser().getId());
            tokenRevocationService.revokeUser(refreshToken.getUser().getId());
            log.warn("Refresh token reuse detected for tokenId: {}", tokenId);
            throw invalidSession();
        }

        refreshToken.setRevokedAt(now);
        return refreshToken;
    }

    public User findRefreshTokenOwner(String rawToken) {
        String[] parts = rawToken.split("\\.", 2);
        if (parts.length != 2)
            return null;
        return refreshTokenRepository.findByTokenId(parts[0])
                .filter(t -> secretMatches(parts[1], t.getTokenHash()))
                .map(RefreshToken::getUser).orElse(null);
    }

    private static ResponseStatusException invalidSession() {
        return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Session expired. Please sign in again.");
    }
}