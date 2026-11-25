package com.sdoc.sdoc.persistance.repository;

import com.sdoc.sdoc.persistance.entity.Ticket;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface TicketRepository extends JpaRepository<Ticket, Long> {
    List<Ticket> findByUserId(Long userId);
    long deleteByMachineId(Long machineId);
    long deleteByUserId(Long userId);

    @Modifying
    @Query("update Ticket t set t.admin = null where t.admin.id = :adminId")
    void clearAdmin(@Param("adminId") Long adminId);

    long countByIsFixedTrue();
    long countByIsFixedFalse();

    long countByPriorityAndIsFixedFalse(int priority);
}