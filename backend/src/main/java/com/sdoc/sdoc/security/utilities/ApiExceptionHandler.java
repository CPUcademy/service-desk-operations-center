package com.sdoc.sdoc.security.utilities;

import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@Slf4j
@RestControllerAdvice
public class ApiExceptionHandler {
    private static final String GENERIC_MESSAGE = "Request failed";

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> handleStatus(ResponseStatusException ex) {
        String message = ex.getReason() == null ? GENERIC_MESSAGE : ex.getReason();
        return ResponseEntity.status(ex.getStatusCode()).body(Map.of("message", message));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, String>> handleAccessDenied() {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Access denied"));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> handleOther(Exception ex, HttpServletRequest request) {
        if (ex instanceof ErrorResponse errorResponse)
            return ResponseEntity.status(errorResponse.getStatusCode()).body(Map.of("message", GENERIC_MESSAGE));
        if (ex instanceof HttpMessageNotReadableException || ex instanceof IllegalArgumentException)
            return ResponseEntity.badRequest().body(Map.of("message", GENERIC_MESSAGE));
        log.error("Unhandled exception at {}", request.getRequestURI(), ex);
        return ResponseEntity.internalServerError().body(Map.of("message", GENERIC_MESSAGE));
    }
}
