package com.sdoc.sdoc.api.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.zip.Deflater;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;

// Public except /key: the package holds no secrets
@RestController
@RequestMapping(AgentController.PREFIX)
public class AgentController {
    public static final String PREFIX = "/api/v1/agent";

    private final Resource agentPackage;
    private final String workerKey;
    private final JsonMapper jsonMapper;

    public AgentController(@Value("${agent.package:/app/agent/sdoc-agent.zip}") String packagePath, @Value("${worker.api-key}") String workerKey,
                           JsonMapper jsonMapper) {
        this.agentPackage = new FileSystemResource(packagePath);
        this.workerKey = workerKey;
        this.jsonMapper = jsonMapper;
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/key")
    public ResponseEntity<Map<String, String>> key() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(Map.of("key", workerKey));
    }

    @GetMapping("/download")
    public ResponseEntity<StreamingResponseBody> download() {
        if (!agentPackage.exists())
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Agent package is not available on this server");
        String server = serverUrl();
        StreamingResponseBody body = out -> {
            try (var in = new ZipInputStream(agentPackage.getInputStream()); var zip = new ZipOutputStream(out)) {
                zip.setLevel(Deflater.BEST_SPEED);
                for (ZipEntry entry; (entry = in.getNextEntry()) != null; ) {
                    zip.putNextEntry(new ZipEntry(entry.getName()));
                    if (entry.getName().equals("appsettings.json")) {
                        ObjectNode settings = (ObjectNode) jsonMapper.readTree(in.readAllBytes());
                        ((ObjectNode) settings.get("Agent")).put("ServerUrl", server);
                        zip.write(jsonMapper.writerWithDefaultPrettyPrinter().writeValueAsBytes(settings));
                    } else {
                        in.transferTo(zip);
                    }
                    zip.closeEntry();
                }
            }
        };
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename("sdoc-agent.zip").build().toString())
                .body(body);
    }

    @GetMapping(value = "/install.ps1", produces = "text/plain;charset=UTF-8")
    public String installScript() throws IOException {
        String script = new ClassPathResource("agent/install.ps1").getContentAsString(StandardCharsets.UTF_8);
        return script.replace("__SERVER__", serverUrl());
    }

    private static String serverUrl() {
        return ServletUriComponentsBuilder.fromCurrentContextPath().toUriString().replace("'", "");
    }
}
