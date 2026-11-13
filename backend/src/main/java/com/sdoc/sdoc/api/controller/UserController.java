package com.sdoc.sdoc.api.controller;

import com.sdoc.sdoc.security.utilities.SecurityUtils;
import com.sdoc.sdoc.service.UserService;
import com.sdoc.sdoc.service.auth.AuthService;
import com.sdoc.sdoc.service.tokens.TokenRevocationService;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserController {
    private final UserService userService;
    private final AuthService authService;
    private final TokenRevocationService tokenRevocationService;

    @DeleteMapping("/me")
    public ResponseEntity<Void> deleteAccount(Authentication authentication, @RequestBody(required = false) Map<String, String> body, HttpServletResponse response) {
        Long userId = SecurityUtils.getUserId(authentication);
        userService.deleteAccount(userId, body == null ? Map.of() : body);
        tokenRevocationService.revokeUser(userId);
        authService.clearAuthCookies(response);
        return ResponseEntity.noContent().build();
    }
}
