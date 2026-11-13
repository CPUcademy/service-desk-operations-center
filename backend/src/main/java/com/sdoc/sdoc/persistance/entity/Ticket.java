package com.sdoc.sdoc.persistance.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter @Setter @Entity
@Table(name="\"Ticket\"")
public class Ticket {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name="\"id\"", nullable = false)
    private long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name="\"adminId\"")
    private User admin;

    @ManyToOne(fetch = FetchType.LAZY,optional = false)
    @JoinColumn(name="\"machineId\"", nullable = false)
    private Machine machine;

    @Column(name = "\"description\"")
    private String description;

    @Column(name = "\"priority\"")
    private int priority;

    @Column(name = "\"isFixed\"")
    private boolean isFixed;
}
