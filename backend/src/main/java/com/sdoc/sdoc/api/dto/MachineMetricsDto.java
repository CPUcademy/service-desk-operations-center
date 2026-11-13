package com.sdoc.sdoc.api.dto;

import java.time.Instant;

public record MachineMetricsDto(Double cpuUsage, Double ramUsage,
                                Double latencyMs, Instant reportedAt) {}
