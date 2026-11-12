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

    // Convenience constructor for OAuth user info (without id/username)
    public UserDataDto(String email, String fullName) {
        this.email = email;
        this.fullName = fullName;
    }
}