package com.sdoc.sdoc.security;

import java.time.Instant;

public record JwtClaim(Long userId, boolean isAdmin, Instant issuedAt) {}