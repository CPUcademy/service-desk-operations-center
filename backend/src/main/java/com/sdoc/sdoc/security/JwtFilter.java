package com.sdoc.sdoc.security;

import com.sdoc.sdoc.service.auth.AuthService;
import com.sdoc.sdoc.service.auth.JwtService;
import com.sdoc.sdoc.service.tokens.TokenRevocationService;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

public class JwtFilter extends OncePerRequestFilter {
    static final String PUBLIC_PREFIX = "/api/v1/auth/";
    private final JwtService jwtService;
    private final TokenRevocationService tokenRevocationService;
    private final AuthService authService;

    public JwtFilter(JwtService jwtService, TokenRevocationService tokenRevocationService, AuthService authService) {
        this.jwtService = jwtService;
        this.tokenRevocationService = tokenRevocationService;
        this.authService = authService;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return request.getRequestURI().startsWith(PUBLIC_PREFIX) || "OPTIONS".equalsIgnoreCase(request.getMethod());
    }

    @SuppressWarnings("NullableProblems")
    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain) throws ServletException, IOException {
        String token = authService.resolveAccessToken(request);
        if (token == null || token.isBlank()) {
            filterChain.doFilter(request, response);
            return;
        }

        JwtClaim principal;
        try {
            if (tokenRevocationService.isAccessTokenRevoked(token))
                throw new IllegalArgumentException("Access token has been revoked");
            principal = jwtService.validateAccessToken(token);
            if (tokenRevocationService.isUserRevoked(principal.userId(), principal.issuedAt()))
                throw new IllegalArgumentException("User has been revoked");
        } catch (JwtException | IllegalArgumentException ex) {
            SecurityContextHolder.clearContext();
            sendUnauthorized(response);
            return;
        }

        UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(principal, null, authoritiesFor(principal));
        authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
        SecurityContextHolder.getContext().setAuthentication(authentication);
        filterChain.doFilter(request, response);
    }

    private static List<GrantedAuthority> authoritiesFor(JwtClaim principal) {
        String role = principal.isAdmin() ? "ROLE_ADMIN" : "ROLE_USER";
        return List.of(new SimpleGrantedAuthority(role));
    }

    private static void sendUnauthorized(HttpServletResponse response) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write("{\"message\":\"Session expired. Please sign in again.\"}");
    }
}
