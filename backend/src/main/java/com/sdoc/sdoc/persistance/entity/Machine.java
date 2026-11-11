package com.sdoc.sdoc.persistance.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
@Getter @Setter @Entity
@Table(name="\"Machine\"")
public class Machine {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "\"id\"")
    private Long id;

    @Column(name = "\"type\"", nullable = false)
    private String type;

    @Column(name = "\"department\"", nullable = false)
    private  String department;

    @Column(name = "\"status\"", nullable = false)
    private  String status;

    @Column(name = "\"hostname\"", nullable = false)
    private  String hostname;

    @Column(name = "\"ipAddress\"",nullable = false)
    private  String ipAddress;

}
