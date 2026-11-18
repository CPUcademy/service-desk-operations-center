package com.sdoc.sdoc.persistance.repository;

import com.sdoc.sdoc.persistance.entity.Machine;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface MachineRepository extends JpaRepository<Machine, Long> {
    List<Machine> findByOwnerId(Long ownerId);
}
