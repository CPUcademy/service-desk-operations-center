package com.sdoc.sdoc.api.dto;

public record CreateUserRequestDto(String fullName, String email, String password, Boolean isAdmin) {}
