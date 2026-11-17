package com.sdoc.sdoc.api.dto;

public record TicketStatsDto(
        long allTickets,
        long openTickets,
        long closedTickets,
        long openCriticalPriorityTickets,
        long openHighPriorityTickets,
        long openMediumPriorityTickets
) {
}