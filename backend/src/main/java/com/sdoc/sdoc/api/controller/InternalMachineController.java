package com.sdoc.sdoc.api.controller;

import com.sdoc.sdoc.api.dto.MachineMetricsDto;
import com.sdoc.sdoc.service.MachineService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

@RestController
@RequestMapping("/api/v1/internal/machines")
public class InternalMachineController {
    public static final String PREFIX = "/api/v1/internal/";
    private final MachineService machineService;
    private final byte[] workerKey;

    public InternalMachineController(MachineService machineService, @Value("${worker.api-key}") String workerKey) {
        if (workerKey.length() < 32)
            throw new IllegalStateException("WORKER_API_KEY must be at least 32 characters");
        this.machineService = machineService;
        this.workerKey = workerKey.getBytes(StandardCharsets.UTF_8);
    }

    @PostMapping("/{id}/metrics")
    public ResponseEntity<Void> saveMetrics(@PathVariable Long id, @RequestHeader(value = "X-Worker-Key", required = false) String key,
                                            @RequestBody MachineMetricsDto dto) {
        if (key == null || !MessageDigest.isEqual(key.getBytes(StandardCharsets.UTF_8), workerKey))
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid worker key");
        machineService.saveMetrics(id, dto);
        return ResponseEntity.noContent().build();
    }
}
