package com.sdoc.sdoc.service;

import com.sdoc.sdoc.persistance.entity.Ticket;
import com.sdoc.sdoc.persistance.repository.TicketRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
@RequiredArgsConstructor
public class TicketService {
    private final TicketRepository ticketRepository;

    public List<Ticket> getAll() {
        return ticketRepository.findAll(Sort.by("id")).stream().toList();
    }
}