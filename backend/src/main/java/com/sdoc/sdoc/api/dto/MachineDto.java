package com.sdoc.sdoc.api.dto;

public record MachineDto(
    Long id, 
    String type, 
    String department, 
    String status,                
    String hostname, 
    String ipAddress, 
    MachineMetricsDto metrics,
    Long ownerId,
    String ownerFullName,
    boolean remoteControl
) {}
