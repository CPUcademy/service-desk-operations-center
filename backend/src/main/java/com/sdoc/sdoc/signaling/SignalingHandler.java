package com.sdoc.sdoc.signaling;

import com.sdoc.sdoc.security.JwtClaim;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

import java.io.IOException;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class SignalingHandler extends TextWebSocketHandler {
    private static final Set<String> ALLOWED_TYPES = Set.of("offer", "answer", "ice", "hangup");
    private static final String USER_ID = "userId";

    // userId -> that user's socket (decorator makes sendMessage thread-safe)
    private final Map<Long, ConcurrentWebSocketSessionDecorator> sessions = new ConcurrentHashMap<>();
    private final JsonMapper jsonMapper;

    public SignalingHandler(JsonMapper jsonMapper) {
        this.jsonMapper = jsonMapper;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws IOException {
        // JwtFilter already authenticated the handshake from the sdoc_access cookie
        if (!(session.getPrincipal() instanceof Authentication auth) || !(auth.getPrincipal() instanceof JwtClaim claim)) {
            session.close(CloseStatus.POLICY_VIOLATION);
            return;
        }
        session.getAttributes().put(USER_ID, claim.userId());
        var previous = sessions.put(claim.userId(), new ConcurrentWebSocketSessionDecorator(session, 5_000, 512 * 1024));
        if (previous != null) previous.close(CloseStatus.NORMAL); // one active tab per user
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws IOException {
        Long from = (Long) session.getAttributes().get(USER_ID);
        if (from == null) return;

        JsonNode node;
        try {
            node = jsonMapper.readTree(message.getPayload());
        } catch (JacksonException e) {
            return; // ignore malformed messages
        }
        if (!(node instanceof ObjectNode msg) || !ALLOWED_TYPES.contains(msg.path("type").asString(""))) return;

        long to = msg.path("to").asLong(-1);
        if (to == from) return;

        WebSocketSession target = sessions.get(to);
        if (target == null || !target.isOpen()) {
            var sender = sessions.get(from);
            if (sender != null)
                sender.sendMessage(new TextMessage("{\"type\":\"unavailable\",\"from\":" + to + "}"));
            return;
        }

        msg.remove("to");
        msg.put("from", from); // set server-side, cannot be spoofed
        target.sendMessage(new TextMessage(jsonMapper.writeValueAsString(msg)));
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        Long userId = (Long) session.getAttributes().get(USER_ID);
        if (userId == null) return;
        // Remove only if it's still this socket (a newer tab may have replaced it)
        sessions.computeIfPresent(userId, (id, current) -> current.getDelegate() == session ? null : current);
    }
}