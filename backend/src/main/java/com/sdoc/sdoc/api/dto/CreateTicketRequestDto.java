package com.sdoc.sdoc.api.dto;

public record CreateTicketRequestDto (Long machineId, String description, Integer priority) {}