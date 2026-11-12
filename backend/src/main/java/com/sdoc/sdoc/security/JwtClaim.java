package com.sdoc.sdoc.security;

public record JwtClaim(Long userId, boolean isAdmin) {}