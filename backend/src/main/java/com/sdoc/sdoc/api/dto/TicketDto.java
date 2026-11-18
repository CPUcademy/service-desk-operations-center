package com.sdoc.sdoc.api.dto;

import java.time.Instant;

public record TicketDto(
    long id, 
    Long adminId, 
    long userId, 
    long machineId,           
    String description, 
    int priority, 
    boolean isFixed,         
    String adminFullName, 
    String userFullName, 
    String machineHostname,
    Instant createdAt,
    Instant closedAt
) {}
