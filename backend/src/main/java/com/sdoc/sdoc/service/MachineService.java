package com.sdoc.sdoc.service;

import com.sdoc.sdoc.persistance.entity.Machine;
import com.sdoc.sdoc.persistance.repository.MachineRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class MachineService {
    private final MachineRepository machineRepository;

    public List<Machine> getAll() {
        return machineRepository.findAll(Sort.by("id"));
    }
}
