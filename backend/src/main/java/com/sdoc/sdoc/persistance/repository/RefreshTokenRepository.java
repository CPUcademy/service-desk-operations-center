package com.sdoc.sdoc.persistance.repository;

import com.sdoc.sdoc.persistance.entity.RefreshToken;
import com.sdoc.sdoc.persistance.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {
    List<RefreshToken> findAllByUserAndRevokedAtIsNull(User user);
    Optional<RefreshToken> findByTokenId(String tokenId);
    List<RefreshToken> findAllByExpiresAtBefore(Instant now);
    List<RefreshToken> findAllByUser(User user);
    void deleteByUserId(Long userId);
}
