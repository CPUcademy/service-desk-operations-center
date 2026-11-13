package com.sdoc.sdoc.api.controller;

import com.sdoc.sdoc.api.dto.AuthResponseDto;
import com.sdoc.sdoc.api.dto.LoginRequestDto;
import com.sdoc.sdoc.api.dto.RegisterRequestDto;
import com.sdoc.sdoc.service.auth.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {
    private final AuthService authService;

    @PostMapping("/register")
    public ResponseEntity<AuthResponseDto> register(@RequestBody RegisterRequestDto dto, HttpServletResponse response) {
        return respond(authService.register(dto), response);
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponseDto> login(@RequestBody LoginRequestDto dto, HttpServletRequest request, HttpServletResponse response) {
        return respond(authService.login(dto, request.getRemoteAddr()), response);
    }

    @PostMapping("/refresh")
    public ResponseEntity<AuthResponseDto> refresh(HttpServletRequest request, HttpServletResponse response) {
        String refreshToken = authService.resolveRefreshToken(request);
        if (refreshToken == null || refreshToken.isBlank())
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Session expired. Please sign in again.");
        return respond(authService.refresh(refreshToken), response);
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request, HttpServletResponse response) {
        authService.logout(authService.resolveAccessToken(request), authService.resolveRefreshToken(request));
        authService.clearAuthCookies(response);
        return ResponseEntity.noContent().build();
    }

    private ResponseEntity<AuthResponseDto> respond(AuthResponseDto tokens, HttpServletResponse response) {
        authService.setAuthCookies(response, tokens);
        return ResponseEntity.noContent().build();
    }
}
