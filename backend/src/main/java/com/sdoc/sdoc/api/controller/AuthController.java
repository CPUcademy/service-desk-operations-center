package com.sdoc.sdoc.api.controller;

import com.sdoc.sdoc.api.dto.AuthResponseDto;
import com.sdoc.sdoc.api.dto.LoginRequestDto;
import com.sdoc.sdoc.api.dto.RegisterRequestDto;
import com.sdoc.sdoc.security.utilities.SecurityUtils;
import com.sdoc.sdoc.service.auth.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

// Web clients get httpOnly cookies; native clients (X-Client-Type: native) get tokens in the body.
@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {
    private final AuthService authService;

    @PostMapping("/register")
    public ResponseEntity<AuthResponseDto> register(@RequestBody RegisterRequestDto dto, HttpServletRequest request, HttpServletResponse response) {
        boolean nativeClient = isNative(request);
        return respond(authService.register(dto, nativeClient), nativeClient, response);
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponseDto> login(@RequestBody LoginRequestDto dto, HttpServletRequest request, HttpServletResponse response) {
        boolean nativeClient = isNative(request);
        return respond(authService.login(dto, request.getRemoteAddr(), nativeClient), nativeClient, response);
    }

    @PostMapping("/refresh")
    public ResponseEntity<AuthResponseDto> refresh(@RequestBody(required = false) Map<String, String> body, HttpServletRequest request, HttpServletResponse response) {
        boolean nativeClient = isNative(request);
        String refreshToken = nativeClient ? (body == null ? null : body.get("refreshToken")) : authService.resolveRefreshToken(request);
        if (refreshToken == null || refreshToken.isBlank())
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Session expired. Please sign in again.");
        return respond(authService.refresh(refreshToken, nativeClient), nativeClient, response);
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(Authentication authentication, HttpServletRequest request, HttpServletResponse response) {
        authService.logout(SecurityUtils.getUserId(authentication), authService.resolveAccessToken(request));
        authService.clearAuthCookies(response);
        return ResponseEntity.noContent().build();
    }

    private static boolean isNative(HttpServletRequest request) {
        return "native".equalsIgnoreCase(request.getHeader("X-Client-Type"));
    }

    private ResponseEntity<AuthResponseDto> respond(AuthResponseDto tokens, boolean nativeClient, HttpServletResponse response) {
        if (nativeClient)
            return ResponseEntity.ok(tokens);
        authService.setAuthCookies(response, tokens);
        return ResponseEntity.noContent().build();
    }
}
