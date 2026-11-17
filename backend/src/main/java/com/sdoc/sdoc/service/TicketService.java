package com.sdoc.sdoc.service;

import com.sdoc.sdoc.api.dto.TicketDto;
import com.sdoc.sdoc.persistance.entity.Ticket;
import com.sdoc.sdoc.persistance.entity.User;
import com.sdoc.sdoc.persistance.entity.Machine;
import com.sdoc.sdoc.persistance.repository.TicketRepository;
import com.sdoc.sdoc.persistance.repository.UserRepository;
import com.sdoc.sdoc.persistance.repository.MachineRepository;
import com.sdoc.sdoc.api.dto.CreateTicketRequestDto;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
@RequiredArgsConstructor
public class TicketService {
    private final TicketRepository ticketRepository;
    private final UserRepository userRepository;
    private final MachineRepository machineRepository;

    public List<TicketDto> getAll() {
        return ticketRepository.findAll(Sort.by("id")).stream().map(this::convertToDTO).toList();
    }

    private TicketDto convertToDTO(Ticket ticket) {
        User admin = ticket.getAdmin();
        Long adminId = admin != null ? admin.getId() : null;
        String adminFullName = admin != null ? admin.getFullName() : null;

        return new TicketDto(ticket.getId(), adminId, ticket.getUser().getId(),
                ticket.getMachine().getId(), ticket.getDescription(), ticket.getPriority(), ticket.isFixed(),
                adminFullName, ticket.getUser().getFullName(), ticket.getMachine().getHostname()
        );
    }

    public List<TicketDto> getUserTickets(long userId){
        return ticketRepository.findByUserId(userId).stream().map(this::convertToDTO).toList();
    }

    public TicketDto createTicket(CreateTicketRequestDto ticketFromFrontend, long userId) {
        Machine machine = machineRepository.findById(ticketFromFrontend.machineId()).orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Machine not found"));
        User user = userRepository.findById(userId).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Error! Please sign in again."));

        Ticket ticket = new Ticket();
        ticket.setMachine(machine);
        ticket.setUser(user);
        ticket.setDescription(ticketFromFrontend.description());
        ticket.setPriority(ticketFromFrontend.priority());

        ticket = ticketRepository.save(ticket);

        return convertToDTO(ticket);
    }

    public void markTicketAsFixed(long id, Long adminId) {
        Ticket ticket = ticketRepository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ticket not found"));
        User admin = userRepository.findById(adminId).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Error! Please sign in again."));
        ticket.setAdmin(admin);
        ticket.setFixed(true);
        ticketRepository.save(ticket);
    }
}