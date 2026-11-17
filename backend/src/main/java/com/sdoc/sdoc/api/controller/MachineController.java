package com.sdoc.sdoc.api.controller;

import com.sdoc.sdoc.api.dto.MachineDto;
import com.sdoc.sdoc.service.MachineService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/machines")
@RequiredArgsConstructor
public class MachineController {
    private final MachineService machineService;

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping
    public List<MachineDto> getAll() {
        return machineService.getAll();
    }
}
