package com.sdoc.sdoc.api.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class UserDataDto {
    private Long id;
    private String fullName;
    private String email;
    private Boolean isAdmin;
}