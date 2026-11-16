package com.sdoc.sdoc.api.controller;

import com.sdoc.sdoc.api.dto.CreateTicketRequestDto;
import com.sdoc.sdoc.api.dto.TicketDto;
import com.sdoc.sdoc.security.utilities.SecurityUtils;
import com.sdoc.sdoc.service.TicketService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/tickets")
@RequiredArgsConstructor
public class TicketController {
    private final TicketService ticketService;

    @PostMapping("/post")
    public TicketDto postTicket(Authentication authentication, @RequestBody CreateTicketRequestDto body) {
        return ticketService.createTicket(body, SecurityUtils.getUserId(authentication));
    }

    @PostMapping("/fixed")
    public ResponseEntity<Void> markTicketAsFixed(long id, Long adminId) {
        ticketService.markTicketAsFixed(id, adminId);
        return ResponseEntity.ok().build();
    }
}
