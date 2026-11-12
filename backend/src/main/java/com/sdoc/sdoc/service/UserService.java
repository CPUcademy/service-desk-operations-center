package com.sdoc.sdoc.service;

import com.sdoc.sdoc.persistance.entity.User;
import com.sdoc.sdoc.persistance.repository.RefreshTokenRepository;
import com.sdoc.sdoc.persistance.repository.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class UserService {
    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final BCryptPasswordEncoder passwordEncoder;

    @PersistenceContext
    private EntityManager entityManager;

    @Transactional
    public void deleteAccount(Long userId, Map<String, String> body) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Session expired. Please sign in again."));
        if (user.getOauthProvider() == null) {
            String password = body.get("password");
            if (password == null || password.length() > 72 || !passwordEncoder.matches(password, user.getPasswordHash()))
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Invalid password");
        }

        entityManager.createNativeQuery("UPDATE \"Ticket\" SET \"adminId\" = NULL WHERE \"adminId\" = :id")
                .setParameter("id", userId).executeUpdate();
        entityManager.createNativeQuery("DELETE FROM \"Ticket\" WHERE \"userId\" = :id")
                .setParameter("id", userId).executeUpdate();
        refreshTokenRepository.deleteByUserId(userId);
        userRepository.delete(user);
    }
}
