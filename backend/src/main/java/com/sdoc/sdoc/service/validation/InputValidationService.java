package com.sdoc.sdoc.service.validation;

import org.springframework.stereotype.Service;

@Service
public class InputValidationService {
    private static final String VALID_NAME_PATTERN = "^[a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻäöüßÄÖÜß\\s\\-']*$";
    private static final String VALID_EMAIL_PATTERN = "^[a-zA-Z0-9._%\\-+]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}$";
    private static final String VALID_PASSWORD_PATTERN = "^[a-zA-Z0-9!@#$%^&*\\-_+=~`|\\\\:;\"'<>,.?/()\\[\\]{}]*$";

    public String validateFullName(String fullName) {
        if (fullName == null || fullName.trim().isEmpty())
            return "Full name is required";
        if (fullName.length() > 100)
            return "Full name must not exceed 100 characters";
        if (!fullName.matches(VALID_NAME_PATTERN))
            return "Full name contains invalid characters. Only letters, numbers, hyphens, and apostrophes are allowed.";
        return null;
    }

    public String validateEmail(String email) {
        if (email == null || email.trim().isEmpty())
            return "Email is required";
        if (email.length() > 100)
            return "Email must not exceed 100 characters";
        if (!email.matches(VALID_EMAIL_PATTERN))
            return "Email address is invalid";
        return null;
    }

    public String validatePassword(String password) {
        if (password == null || password.isEmpty())
            return "Password is required";
        if (password.length() < 12)
            return "Password must be at least 12 characters";
        if (password.length() > 72)
            return "Password must not exceed 72 characters";
        if (!password.matches(VALID_PASSWORD_PATTERN))
            return "Password contains invalid characters. Use letters, numbers, and common special characters (!@#$%^&*-_+=~|:;\"'<>,.?/()[]{})";
        if (!password.matches(".*[A-Z].*"))
            return "Password must contain at least one uppercase letter";
        if (!password.matches(".*[a-z].*"))
            return "Password must contain at least one lowercase letter";
        if (!password.matches(".*[0-9].*"))
            return "Password must contain at least one number";
        if (!password.matches(".*[!@#$%^&*\\-_+=~`|\\\\:;\"'<>,.?/()\\[\\]{}].*"))
            return "Password must contain at least one special character";
        return null;
    }
}
