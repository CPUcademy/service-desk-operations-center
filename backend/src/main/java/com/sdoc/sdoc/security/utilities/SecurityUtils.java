package com.sdoc.sdoc.security.utilities;

import com.sdoc.sdoc.security.JwtClaim;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.server.ResponseStatusException;

public class SecurityUtils {
    public static Long getUserId(Authentication authentication) {
        if (authentication == null || authentication.getPrincipal() == null)
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Session expired. Please sign in again.");
        JwtClaim principal = (JwtClaim) authentication.getPrincipal();
        return principal.userId();
    }

    public static boolean isAdmin(Authentication authentication) {
        return authentication != null && authentication.getPrincipal() instanceof JwtClaim claim && claim.isAdmin();
    }
}