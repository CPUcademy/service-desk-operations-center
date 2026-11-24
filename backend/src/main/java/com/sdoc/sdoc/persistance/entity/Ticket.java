package com.sdoc.sdoc.persistance.entity;

import java.time.Instant;

import org.hibernate.annotations.Generated;

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

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name="\"userId\"", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY,optional = false)
    @JoinColumn(name="\"machineId\"", nullable = false)
    private Machine machine;

    @Column(name = "\"description\"")
    private String description;

    @Column(name = "\"priority\"")
    private int priority;

    @Column(name = "\"isFixed\"")
    private boolean isFixed;

    @Generated
    @Column(name = "\"createdAt\"", nullable = false, insertable = false, updatable = false)
    private Instant createdAt;
    
    @Column(name = "\"closedAt\"")
    private Instant closedAt;
}
