package com.sdoc.sdoc.persistance.repository;

import com.sdoc.sdoc.persistance.entity.Machine;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface MachineRepository extends JpaRepository<Machine, Long> {
}
