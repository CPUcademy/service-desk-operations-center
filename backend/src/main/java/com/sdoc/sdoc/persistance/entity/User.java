package com.sdoc.sdoc.persistance.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter @Setter @Entity
@Table(name = "\"User\"")
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "\"id\"")
    private Long id;

    @Column(name = "\"fullName\"", nullable = false)
    private String fullName;

    @Column(name = "\"email\"", nullable = false, unique = true)
    private String email;

    @Column(name = "\"passwordHash\"", nullable = false)
    private String passwordHash;

    @Column(name = "\"isAdmin\"", nullable = false)
    private Boolean isAdmin;
}