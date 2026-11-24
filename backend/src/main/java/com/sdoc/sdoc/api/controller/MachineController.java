package com.sdoc.sdoc.api.controller;

import org.springframework.http.ResponseEntity;

import com.sdoc.sdoc.api.dto.RemoteControlRequestDto;
import org.springframework.web.bind.annotation.PatchMapping;

import com.sdoc.sdoc.api.dto.CreateMachineRequestDto;
import com.sdoc.sdoc.api.dto.MachineDto;
import com.sdoc.sdoc.security.utilities.SecurityUtils;
import com.sdoc.sdoc.service.MachineService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
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

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/{id}")
    public MachineDto getMachineById(@PathVariable long id) {
        return machineService.getMachineById(id);
    }

    @GetMapping("/me")
    public List<MachineDto> getMachinesByOwnerId(Authentication auth) {
        return machineService.getMachinesByOwnerId(SecurityUtils.getUserId(auth));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/{id}")
    public MachineDto update(@PathVariable long id, @RequestBody CreateMachineRequestDto body) {
        return machineService.update(id, body);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable long id, @RequestParam(defaultValue = "") String confirmHostname, Authentication auth) {
        machineService.delete(id, confirmHostname, SecurityUtils.getUserId(auth));
        return ResponseEntity.noContent().build();
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PatchMapping("/{id}/remote-control")
    public MachineDto setRemoteControl(@PathVariable long id, @RequestBody RemoteControlRequestDto body, Authentication auth) {
        return machineService.setRemoteControl(id, body, SecurityUtils.getUserId(auth));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping
    public MachineDto create(@RequestBody CreateMachineRequestDto body) {
        return machineService.create(body);
    }
}
