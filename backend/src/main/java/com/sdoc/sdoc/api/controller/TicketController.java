package com.sdoc.sdoc.api.controller;

import com.sdoc.sdoc.api.dto.CreateTicketRequestDto;
import com.sdoc.sdoc.api.dto.TicketDto;
import com.sdoc.sdoc.api.dto.TicketStatsDto;
import com.sdoc.sdoc.security.utilities.SecurityUtils;
import com.sdoc.sdoc.service.TicketService;
import lombok.RequiredArgsConstructor;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/tickets")
@RequiredArgsConstructor
public class TicketController {
    private final TicketService ticketService;

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping
    public List<TicketDto> getAllTickets() {
        return ticketService.getAll();
    }

    @PostMapping("/post")
    public TicketDto postTicket(Authentication authentication, @RequestBody CreateTicketRequestDto body) {
        return ticketService.createTicket(body, SecurityUtils.getUserId(authentication));
    }

    @GetMapping("/me")
    public List<TicketDto> getUserTickets(Authentication authentication) {
        return ticketService.getUserTickets(SecurityUtils.getUserId(authentication));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/stats")
    public TicketStatsDto getTicketStatsForDashboard() {
        return ticketService.getTicketStatsForDashboard();
    }


    @PreAuthorize("hasRole('ADMIN')")
    @PatchMapping("/fixed/{id}")
    public ResponseEntity<Void> markTicketAsFixed(@PathVariable long id, Authentication authentication) {
        ticketService.markTicketAsFixed(id, SecurityUtils.getUserId(authentication));
        return ResponseEntity.noContent().build();
    }
}
