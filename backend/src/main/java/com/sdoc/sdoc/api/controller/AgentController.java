package com.sdoc.sdoc.api.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

// Public: the package holds no secrets
@RestController
@RequestMapping(AgentController.PREFIX)
public class AgentController {
    public static final String PREFIX = "/api/v1/agent";

    private final Resource agentPackage;

    public AgentController(@Value("${agent.package:/app/agent/sdoc-agent.zip}") String packagePath) {
        this.agentPackage = new FileSystemResource(packagePath);
    }

    @GetMapping("/download")
    public ResponseEntity<Resource> download() {
        if (!agentPackage.exists())
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Agent package is not available on this server");
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename("sdoc-agent.zip").build().toString())
                .body(agentPackage);
    }

    @GetMapping(value = "/install.ps1", produces = "text/plain;charset=UTF-8")
    public String installScript() throws IOException {
        String server = ServletUriComponentsBuilder.fromCurrentContextPath().toUriString();
        String script = new ClassPathResource("agent/install.ps1").getContentAsString(StandardCharsets.UTF_8);
        return script.replace("__SERVER__", server.replace("'", ""));
    }
}
