package com.sdoc.sdoc.api.controller;

import com.sdoc.sdoc.persistance.entity.Machine;
import com.sdoc.sdoc.service.MachineService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/machines")
@RequiredArgsConstructor
public class MachineController {
    private final MachineService machineService;

    @GetMapping
    public List<Machine> getAll() {
        return machineService.getAll();
    }
}
