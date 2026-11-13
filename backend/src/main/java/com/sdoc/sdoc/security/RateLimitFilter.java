package com.sdoc.sdoc.security;

import com.sdoc.sdoc.api.controller.InternalMachineController;
import com.sdoc.sdoc.service.RateLimitService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

public class RateLimitFilter extends OncePerRequestFilter {
    private static final int SENSITIVE_LIMIT_PER_MINUTE = 20;
    private static final int DEFAULT_LIMIT_PER_MINUTE = 120;
    private final RateLimitService rateLimitService;

    public RateLimitFilter(RateLimitService rateLimitService) {
        this.rateLimitService = rateLimitService;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        // Workers may share one NAT IP
        return "OPTIONS".equalsIgnoreCase(request.getMethod()) || request.getRequestURI().startsWith(InternalMachineController.PREFIX);
    }

    @SuppressWarnings("NullableProblems")
    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain) throws ServletException, IOException {
        boolean sensitive = request.getRequestURI().startsWith(JwtFilter.PUBLIC_PREFIX) || "DELETE".equalsIgnoreCase(request.getMethod());
        String key = (sensitive ? "sensitive:" : "default:") + request.getRemoteAddr();
        if (!rateLimitService.tryAcquire(key, sensitive ? SENSITIVE_LIMIT_PER_MINUTE : DEFAULT_LIMIT_PER_MINUTE)) {
            response.setStatus(429);
            response.setHeader("Retry-After", "60");
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"message\":\"Too many requests. Please try again later.\"}");
            return;
        }
        filterChain.doFilter(request, response);
    }
}
