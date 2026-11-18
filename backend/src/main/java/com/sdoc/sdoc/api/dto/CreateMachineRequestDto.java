package com.sdoc.sdoc.api.dto;

public record CreateMachineRequestDto(String type, String department, String hostname, String ipAddress, Long ownerId) {}
