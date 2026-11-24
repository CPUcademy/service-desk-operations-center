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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;
import java.util.zip.Deflater;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;

// Public except /key: the packages hold no secrets
@RestController
@RequestMapping(AgentController.PREFIX)
public class AgentController {
    public static final String PREFIX = "/api/v1/worker";

    private final Resource windowsPackage;
    private final Resource linuxPackage;
    private final String workerKey;
    private final JsonMapper jsonMapper;
    private final Map<String, Path> stamped = new HashMap<>();

    public AgentController(@Value("${worker.package.windows:/app/worker/sdoc-worker.zip}") String windowsPath,
                           @Value("${worker.package.linux:/app/worker/sdoc-worker-linux.tar.gz}") String linuxPath,
                           @Value("${worker.api-key}") String workerKey, JsonMapper jsonMapper) {
        this.windowsPackage = new FileSystemResource(windowsPath);
        this.linuxPackage = new FileSystemResource(linuxPath);
        this.workerKey = workerKey;
        this.jsonMapper = jsonMapper;
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/key")
    public ResponseEntity<Map<String, String>> key() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(Map.of("key", workerKey));
    }

    @GetMapping("/download")
    public ResponseEntity<Resource> download(@RequestParam(defaultValue = "windows") String os) throws IOException {
        boolean linux = os.equals("linux");
        Resource source = linux ? linuxPackage : windowsPackage;
        if (!source.exists())
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Worker package is not available on this server");
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(linux ? "sdoc-worker-linux.tar.gz" : "sdoc-worker.zip").build().toString())
                .body(linux ? linuxPackage : new FileSystemResource(stampedPackage(serverUrl())));
    }

    private synchronized Path stampedPackage(String server) throws IOException {
        Path cached = stamped.get(server);
        if (cached != null && Files.exists(cached)) return cached;
        Path target = Files.createTempFile("sdoc-worker-", ".zip");
        try (var in = new ZipInputStream(windowsPackage.getInputStream()); var zip = new ZipOutputStream(Files.newOutputStream(target))) {
            zip.setLevel(Deflater.BEST_SPEED);
            for (ZipEntry entry; (entry = in.getNextEntry()) != null; ) {
                zip.putNextEntry(new ZipEntry(entry.getName()));
                if (entry.getName().equals("appsettings.json")) {
                    ObjectNode settings = (ObjectNode) jsonMapper.readTree(in.readAllBytes());
                    ((ObjectNode) settings.get("Worker")).put("ServerUrl", server);
                    zip.write(jsonMapper.writerWithDefaultPrettyPrinter().writeValueAsBytes(settings));
                } else {
                    in.transferTo(zip);
                }
                zip.closeEntry();
            }
        } catch (IOException | RuntimeException e) {
            Files.deleteIfExists(target);
            throw e;
        }
        stamped.put(server, target);
        return target;
    }

    @GetMapping(value = "/install.ps1", produces = "text/plain;charset=UTF-8")
    public String installScript() throws IOException {
        return script("worker/install.ps1");
    }

    @GetMapping(value = "/install.sh", produces = "text/plain;charset=UTF-8")
    public String installShellScript() throws IOException {
        return script("worker/install.sh").replace("\r", "");
    }

    private static String script(String resource) throws IOException {
        return new ClassPathResource(resource).getContentAsString(StandardCharsets.UTF_8).replace("__SERVER__", serverUrl());
    }

    private static String serverUrl() {
        return ServletUriComponentsBuilder.fromCurrentContextPath().toUriString().replace("'", "").replace("\"", "");
    }
}
