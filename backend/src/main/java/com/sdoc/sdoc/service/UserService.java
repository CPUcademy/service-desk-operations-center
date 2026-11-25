package com.sdoc.sdoc.service;

import com.sdoc.sdoc.api.dto.ContactDto;
import com.sdoc.sdoc.api.dto.UserDataDto;
import com.sdoc.sdoc.signaling.SignalingHandler;
import com.sdoc.sdoc.persistance.entity.User;
import com.sdoc.sdoc.persistance.repository.MachineRepository;
import com.sdoc.sdoc.persistance.repository.RefreshTokenRepository;
import com.sdoc.sdoc.persistance.repository.TicketRepository;
import com.sdoc.sdoc.persistance.repository.UserRepository;
import com.sdoc.sdoc.service.tokens.TokenRevocationService;
import com.sdoc.sdoc.service.validation.InputValidationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserService {
    private static final int MAX_PASSWORD_LENGTH = 72;

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final BCryptPasswordEncoder passwordEncoder;
    private final RateLimitService rateLimitService;
    private final InputValidationService inputValidationService;
    private final SignalingHandler signalingHandler;
    private final MachineRepository machineRepository;
    private final TicketRepository ticketRepository;
    private final TokenRevocationService tokenRevocationService;

    public List<UserDataDto> getAll() {
        return userRepository.findAll(org.springframework.data.domain.Sort.by("fullName")).stream()
                .map(user -> new UserDataDto(user.getId(), user.getFullName(), user.getEmail(), user.getIsAdmin()))
                .toList();
    }

    public List<ContactDto> getContacts(long userId, boolean isAdmin) {
        return userRepository.findAll(org.springframework.data.domain.Sort.by("fullName")).stream()
                .filter(user -> user.getId() != userId && (isAdmin || Boolean.TRUE.equals(user.getIsAdmin())))
                .map(user -> new ContactDto(user.getId(), user.getFullName(), Boolean.TRUE.equals(user.getIsAdmin()), signalingHandler.isOnline(user.getId())))
                .toList();
    }

    @Transactional
    public UserDataDto grantAdmin(long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        user.setIsAdmin(true);
        return new UserDataDto(user.getId(), user.getFullName(), user.getEmail(), true);
    }

    @Transactional
    public void delete(long userId, String confirmEmail, long adminId) {
        if (userId == adminId)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You can't remove your own account");
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        if (!user.getEmail().equalsIgnoreCase(String.valueOf(confirmEmail).trim()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Type the user's email to confirm");
        int machines = machineRepository.findByOwnerId(userId).size();
        if (machines > 0)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This user owns " + machines + " machine(s). Remove them first.");
        long tickets = ticketRepository.deleteByUserId(userId);
        ticketRepository.clearAdmin(userId);
        refreshTokenRepository.deleteByUserId(userId);
        userRepository.delete(user);
        tokenRevocationService.revokeUser(userId);
        log.warn("Admin {} removed user {} ({}) and {} tickets", adminId, userId, user.getEmail(), tickets);
    }

    public UserDataDto getProfile(Long userId) {
        User user = findUser(userId);
        return new UserDataDto(user.getId(), user.getFullName(), user.getEmail(), user.getIsAdmin());
    }

    @Transactional
    public User changePassword(Long userId, Map<String, String> body) {
        User user = findUser(userId);
        String newPassword = body.get("newPassword");
        String validationError = inputValidationService.validatePassword(newPassword);
        if (validationError != null)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, validationError);
        requireReauthenticated(user, body);
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user = userRepository.save(user);
        refreshTokenRepository.deleteByUserId(userId);
        return user;
    }
    @Transactional
    public UserDataDto updateFullName(Long userId, String fullName) {
        String error = inputValidationService.validateFullName(fullName);
        if (error != null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, error);
        User user = findUser(userId);
        user.setFullName(fullName.trim());
        return getProfile(userRepository.save(user).getId());
    }

    private User findUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Session expired. Please sign in again."));
    }

    private void requireReauthenticated(User user, Map<String, String> body) {
        String key = "reauth:" + user.getId();
        rateLimitService.checkLoginLockout(key);
        if (!reauthenticated(user, body)) {
            rateLimitService.recordFailedLogin(key, 2);
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Re-authentication failed");
        }
        rateLimitService.resetFailedLogin(key);
    }

    private boolean reauthenticated(User user, Map<String, String> body) {
        String password = body.get("password");
        return password != null && password.length() <= MAX_PASSWORD_LENGTH && passwordEncoder.matches(password, user.getPasswordHash());
    }
}
