package com.sdoc.sdoc.service;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.sdoc.sdoc.api.dto.MachineDto;
import com.sdoc.sdoc.api.dto.MachineMetricsDto;
import com.sdoc.sdoc.persistance.repository.MachineRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
public class MachineService {
    private static final Duration METRICS_TTL = Duration.ofMinutes(2);
    private final MachineRepository machineRepository;
    private final Cache<Long, MachineMetricsDto> metrics = Caffeine.newBuilder()
            .expireAfterWrite(METRICS_TTL).maximumSize(10_000).build();

    public List<MachineDto> getAll() {
        return machineRepository.findAll(Sort.by("id")).stream()
                .map(m -> new MachineDto(m.getId(), m.getType(), m.getDepartment(), m.getStatus(), m.getHostname(),
                        m.getIpAddress(), metrics.getIfPresent(m.getId()))).toList();
    }

    public void saveMetrics(Long machineId, MachineMetricsDto dto) {
        if (dto == null || isNotPercent(dto.cpuUsage()) || isNotFinite(dto.ramUsed()) || isNotFinite(dto.ramTotal())
                || dto.ramUsed() < 0 || dto.ramTotal() <= 0 || dto.ramUsed() > dto.ramTotal()
                || (dto.latencyMs() != null && (!Double.isFinite(dto.latencyMs()) || dto.latencyMs() < 0)))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid metrics");
        metrics.put(machineId, new MachineMetricsDto(dto.cpuUsage(), dto.ramUsed(), dto.ramTotal(),
                dto.latencyMs(), Instant.now()));
    }

    private static boolean isNotPercent(Double value) {
        return value == null || value < 0 || value > 100;
    }

    private static boolean isNotFinite(Double value) {
        return value == null || !Double.isFinite(value);
    }
}
