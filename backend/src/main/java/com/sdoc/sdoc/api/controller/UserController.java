package com.sdoc.sdoc.api.controller;

import com.sdoc.sdoc.api.dto.ContactDto;
import com.sdoc.sdoc.api.dto.CreateUserRequestDto;
import com.sdoc.sdoc.api.dto.UserDataDto;
import com.sdoc.sdoc.persistance.entity.User;
import com.sdoc.sdoc.security.utilities.SecurityUtils;
import com.sdoc.sdoc.service.UserService;
import com.sdoc.sdoc.service.auth.AuthService;
import com.sdoc.sdoc.service.tokens.TokenRevocationService;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserController {
    private final UserService userService;
    private final AuthService authService;
    private final TokenRevocationService tokenRevocationService;

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping
    public List<UserDataDto> getAll() {
        return userService.getAll();
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping
    public UserDataDto create(@RequestBody CreateUserRequestDto body, Authentication authentication) {
        if (body == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid user data");
        User user = authService.createUser(body.fullName(), body.email(), body.password(), Boolean.TRUE.equals(body.isAdmin()));
        log.warn("Admin {} created user {}{}", SecurityUtils.getUserId(authentication), user.getId(), user.getIsAdmin() ? " as ADMIN" : "");
        return new UserDataDto(user.getId(), user.getFullName(), user.getEmail(), user.getIsAdmin());
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PatchMapping("/{id}/admin")
    public UserDataDto grantAdmin(@PathVariable long id, Authentication authentication) {
        log.warn("Admin {} granted admin rights to user {}", SecurityUtils.getUserId(authentication), id);
        return userService.grantAdmin(id);
    }

    @GetMapping("/contacts")
    public List<ContactDto> contacts(Authentication authentication) {
        return userService.getContacts(SecurityUtils.getUserId(authentication), SecurityUtils.isAdmin(authentication));
    }

    @GetMapping("/me")
    public UserDataDto me(Authentication authentication) {
        return userService.getProfile(SecurityUtils.getUserId(authentication));
    }

    @PostMapping("/me/password")
    public ResponseEntity<Void> changePassword(Authentication authentication, @RequestBody Map<String, String> body, HttpServletResponse response) {
        Long userId = SecurityUtils.getUserId(authentication);
        User user = userService.changePassword(userId, body);
        tokenRevocationService.revokeUser(userId);
        authService.setAuthCookies(response, authService.generateTokens(user));
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/me")
    public UserDataDto updateProfile(Authentication authentication, @RequestBody Map<String, String> body) {
        return userService.updateFullName(SecurityUtils.getUserId(authentication), body.get("fullName"));
    }
}
