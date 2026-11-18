package com.sdoc.sdoc.service;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.sdoc.sdoc.api.dto.MachineDto;
import com.sdoc.sdoc.api.dto.MachineMetricsDto;
import com.sdoc.sdoc.persistance.entity.Machine;
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
    private static final Duration METRICS_TTL = Duration.ofSeconds(30);
    private final MachineRepository machineRepository;
    private final Cache<Long, MachineMetricsDto> metrics = Caffeine.newBuilder()
            .expireAfterWrite(METRICS_TTL).maximumSize(10_000).build();

    private static String liveStatus(String storedStatus, MachineMetricsDto latest) {
        if ("maintenance".equalsIgnoreCase(storedStatus)) return storedStatus;
        return latest != null ? "online" : "offline";
    }

    private MachineDto convertToDto(Machine m) {
        MachineMetricsDto latest = metrics.getIfPresent(m.getId());
        return new MachineDto(m.getId(), m.getType(), m.getDepartment(), liveStatus(m.getStatus(), latest),
                            m.getHostname(), m.getIpAddress(), latest);
    }

    public List<MachineDto> getAll() {
        return machineRepository.findAll(Sort.by("id")).stream().map(this::convertToDto).toList();
    }

    public MachineDto getMachineById(long machineId) {
        return machineRepository.findById(machineId).map(this::convertToDto).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Machine not found"));
    }
    
    public void saveMetrics(Long machineId, MachineMetricsDto dto) {
        if (dto == null || isNotPercent(dto.cpuUsage()) || isNotFinite(dto.ramUsed()) || isNotFinite(dto.ramTotal())
                || dto.ramUsed() < 0 || dto.ramTotal() <= 0 || dto.ramUsed() > dto.ramTotal()
                || (dto.latencyMs() != null && (!Double.isFinite(dto.latencyMs()) || dto.latencyMs() < 0)))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid metrics");
        if (!machineRepository.existsById(machineId))
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Machine not found");
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
