package com.sdoc.sdoc.signaling;

import com.sdoc.sdoc.persistance.entity.Machine;
import com.sdoc.sdoc.persistance.repository.MachineRepository;
import com.sdoc.sdoc.security.JwtClaim;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.AbstractWebSocketHandler;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator.OverflowStrategy;
import org.springframework.web.util.UriComponentsBuilder;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
public class RemoteRelayHandler extends AbstractWebSocketHandler {
    public static final String AGENT_PATH = "/api/v1/internal/agent/*";
    public static final String VIEWER_PATH = "/api/v1/remote/*";

    private static final Set<String> SERVICE_TYPES = Set.of("exec", "restart-agent", "cad", "desktop-start", "file-start");
    private static final Set<String> CONTROL_TYPES = Set.of("exec", "cad", "desktop-start", "file-start", "input");
    private static final Set<String> DESKTOP_TYPES = Set.of("input", "desktop-stop");
    private static final String ROLE = "role", MACHINE = "machine", USER = "user";
    private static final int MAX_COMMAND = 2000;

    private static class Channel {
        volatile WebSocketSession service;
        volatile WebSocketSession desktop;
        volatile String desktopToken;
        volatile Boolean remoteControl;
        volatile boolean agentAllows;
        final Set<WebSocketSession> viewers = ConcurrentHashMap.newKeySet();
    }

    private final Map<Long, Channel> channels = new ConcurrentHashMap<>();
    private final JsonMapper jsonMapper;
    private final MachineRepository machineRepository;
    private final byte[] workerKey;

    public RemoteRelayHandler(JsonMapper jsonMapper, MachineRepository machineRepository, @Value("${worker.api-key}") String workerKey) {
        this.jsonMapper = jsonMapper;
        this.machineRepository = machineRepository;
        this.workerKey = workerKey.getBytes(StandardCharsets.UTF_8);
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws IOException {
        var uri = session.getUri();
        Long machineId = machineId(uri == null ? "" : uri.getPath());
        if (machineId == null) {
            session.close(CloseStatus.BAD_DATA);
            return;
        }
        Channel channel = channels.computeIfAbsent(machineId, id -> new Channel());
        session.getAttributes().put(MACHINE, machineId);

        if (uri.getPath().startsWith("/api/v1/internal/")) {
            String token = UriComponentsBuilder.fromUri(uri).build().getQueryParams().getFirst("token");
            if (token != null) {
                String expected = channel.desktopToken;
                channel.desktopToken = null;
                if (expected == null || !MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), token.getBytes(StandardCharsets.UTF_8))) {
                    session.close(CloseStatus.POLICY_VIOLATION);
                    return;
                }
                if (!allowed(machineId, channel)) {
                    session.close(CloseStatus.POLICY_VIOLATION);
                    return;
                }
                session.getAttributes().put(ROLE, "desktop");
                closeQuietly(channel.desktop);
                channel.desktop = wrap(session, OverflowStrategy.TERMINATE);
            } else {
                String key = session.getHandshakeHeaders().getFirst("X-Worker-Key");
                if (key == null || !MessageDigest.isEqual(key.getBytes(StandardCharsets.UTF_8), workerKey)) {
                    session.close(CloseStatus.POLICY_VIOLATION);
                    return;
                }
                session.getAttributes().put(ROLE, "service");
                closeQuietly(channel.service);
                channel.agentAllows = false;
                channel.service = wrap(session, OverflowStrategy.TERMINATE);
                send(channel.service, policyMessage(allowed(machineId, channel)));
            }
            broadcastStatus(channel);
            return;
        }

        if (!(session.getPrincipal() instanceof Authentication auth) || !(auth.getPrincipal() instanceof JwtClaim claim) || !claim.isAdmin()) {
            session.close(CloseStatus.POLICY_VIOLATION);
            return;
        }
        session.getAttributes().put(ROLE, "viewer");
        session.getAttributes().put(USER, claim.userId());
        WebSocketSession viewer = wrap(session, OverflowStrategy.DROP);
        channel.viewers.add(viewer);
        allowed(machineId, channel);
        viewer.sendMessage(statusMessage(channel));
    }

    @Override
    public void handleMessage(WebSocketSession session, WebSocketMessage<?> message) throws IOException {
        Long machineId = (Long) session.getAttributes().get(MACHINE);
        String role = (String) session.getAttributes().get(ROLE);
        Channel channel = machineId == null ? null : channels.get(machineId);
        if (channel == null || role == null) return;

        if (message instanceof BinaryMessage) {
            if ("desktop".equals(role)) sendAll(channel.viewers, message);
            else if ("viewer".equals(role) && allowed(machineId, channel)) send(channel.service, message);
            return;
        }
        if (!(message instanceof TextMessage text)) return;

        JsonNode node;
        try {
            node = jsonMapper.readTree(text.getPayload());
        } catch (JacksonException e) {
            return;
        }
        String type = node.path("type").asString("");

        switch (role) {
            case "service" -> {
                if (type.equals("desktop-token")) channel.desktopToken = allowed(machineId, channel) ? node.path("token").asString(null) : null;
                else if (type.equals("hello")) {
                    channel.agentAllows = node.path("remoteControl").asBoolean(false);
                    broadcastStatus(channel);
                } else sendAll(channel.viewers, text);
            }
            case "desktop" -> sendAll(channel.viewers, text);
            case "viewer" -> {
                if (CONTROL_TYPES.contains(type) && !(allowed(machineId, channel) && channel.agentAllows)) {
                    deny(session, node, type);
                    return;
                }
                if (SERVICE_TYPES.contains(type)) {
                    if (type.equals("exec") && node.path("command").asString("").length() > MAX_COMMAND) return;
                    log.info("Admin {} -> machine {}: {} {}{}", session.getAttributes().get(USER), machineId, type,
                            node.path("command").asString(""), node.path("path").asString(""));
                    send(channel.service, text);
                } else if (DESKTOP_TYPES.contains(type)) {
                    send(channel.desktop, text);
                }
            }
            default -> { }
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws IOException {
        Long machineId = (Long) session.getAttributes().get(MACHINE);
        String role = (String) session.getAttributes().get(ROLE);
        Channel channel = machineId == null ? null : channels.get(machineId);
        if (channel == null || role == null) return;

        switch (role) {
            case "service" -> {
                if (isSame(channel.service, session)) channel.service = null;
                broadcastStatus(channel);
            }
            case "desktop" -> {
                if (isSame(channel.desktop, session)) channel.desktop = null;
                broadcastStatus(channel);
            }
            case "viewer" -> {
                channel.viewers.removeIf(viewer -> isSame(viewer, session));
                if (channel.viewers.isEmpty()) send(channel.desktop, new TextMessage("{\"type\":\"desktop-stop\"}"));
            }
            default -> { }
        }
    }

    public void applyRemoteControl(long machineId, boolean enabled) {
        Channel channel = channels.computeIfAbsent(machineId, id -> new Channel());
        channel.remoteControl = enabled;
        send(channel.service, policyMessage(enabled));
        if (!enabled) {
            channel.desktopToken = null;
            closeQuietly(channel.desktop);
        }
        broadcastStatus(channel);
    }

    private boolean allowed(long machineId, Channel channel) {
        Boolean cached = channel.remoteControl;
        if (cached != null) return cached;
        boolean enabled = machineRepository.findById(machineId).map(Machine::isRemoteControl).orElse(false);
        channel.remoteControl = enabled;
        return enabled;
    }

    private void deny(WebSocketSession viewer, JsonNode request, String type) {
        String reason = "Remote control is disabled for this machine.";
        var reply = jsonMapper.createObjectNode();
        switch (type) {
            case "exec" -> reply.put("type", "exec-result").put("output", reason).put("exitCode", -1).set("id", request.path("id"));
            case "file-start" -> reply.put("type", "file-error").put("error", reason);
            default -> reply.put("type", "notice").put("text", reason);
        }
        if (!type.equals("input")) send(findViewer(viewer), new TextMessage(jsonMapper.writeValueAsString(reply)));
    }

    private WebSocketSession findViewer(WebSocketSession session) {
        Long machineId = (Long) session.getAttributes().get(MACHINE);
        Channel channel = machineId == null ? null : channels.get(machineId);
        return channel == null ? null : channel.viewers.stream().filter(v -> isSame(v, session)).findFirst().orElse(null);
    }

    private static TextMessage policyMessage(boolean enabled) {
        return new TextMessage("{\"type\":\"policy\",\"remoteControl\":" + enabled + "}");
    }

    private static Long machineId(String path) {
        try {
            return Long.parseLong(path.substring(path.lastIndexOf('/') + 1));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static WebSocketSession wrap(WebSocketSession session, OverflowStrategy overflow) {
        return new ConcurrentWebSocketSessionDecorator(session, 5_000, 4 * 1024 * 1024, overflow);
    }

    private static boolean isSame(WebSocketSession wrapped, WebSocketSession session) {
        return wrapped instanceof ConcurrentWebSocketSessionDecorator decorator && decorator.getDelegate() == session;
    }

    private TextMessage statusMessage(Channel channel) {
        return new TextMessage("{\"type\":\"agent\",\"online\":" + (channel.service != null) + ",\"desktop\":" + (channel.desktop != null)
                + ",\"remoteControl\":" + Boolean.TRUE.equals(channel.remoteControl) + ",\"agentAllows\":" + channel.agentAllows + "}");
    }

    private void broadcastStatus(Channel channel) {
        sendAll(channel.viewers, statusMessage(channel));
    }

    private static void sendAll(Set<WebSocketSession> sessions, WebSocketMessage<?> message) {
        sessions.forEach(session -> send(session, message));
    }

    private static void send(WebSocketSession session, WebSocketMessage<?> message) {
        if (session == null || !session.isOpen()) return;
        try {
            session.sendMessage(message);
        } catch (IOException | IllegalStateException e) {
            log.debug("Relay send failed: {}", e.getMessage());
        }
    }

    private static void closeQuietly(WebSocketSession session) {
        if (session == null) return;
        try {
            session.close(CloseStatus.NORMAL);
        } catch (IOException ignored) {
        }
    }
}
