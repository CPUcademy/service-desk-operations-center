package com.sdoc.sdoc.api.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;

public record MachineMetricsDto(Double cpuUsage, Double ramUsed, Double ramTotal, Double latencyMs,
                                @JsonProperty(access = JsonProperty.Access.READ_ONLY) Instant reportedAt) { }
