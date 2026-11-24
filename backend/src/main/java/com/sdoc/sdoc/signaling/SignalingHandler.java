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

import java.io.IOException;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class SignalingHandler extends TextWebSocketHandler {
    private static final String USER_ID = "userId", IS_ADMIN = "isAdmin";
    private static final int MAX_TEXT = 2000;

    private final Map<Long, ConcurrentWebSocketSessionDecorator> sessions = new ConcurrentHashMap<>();
    private final JsonMapper jsonMapper;

    public SignalingHandler(JsonMapper jsonMapper) {
        this.jsonMapper = jsonMapper;
    }

    public boolean isOnline(long userId) {
        var session = sessions.get(userId);
        return session != null && session.isOpen();
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws IOException {
        if (!(session.getPrincipal() instanceof Authentication auth) || !(auth.getPrincipal() instanceof JwtClaim claim)) {
            session.close(CloseStatus.POLICY_VIOLATION);
            return;
        }
        session.getAttributes().put(USER_ID, claim.userId());
        session.getAttributes().put(IS_ADMIN, claim.isAdmin());
        var previous = sessions.put(claim.userId(), new ConcurrentWebSocketSessionDecorator(session, 5_000, 512 * 1024));
        if (previous != null) previous.close(CloseStatus.NORMAL);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws IOException {
        Long from = (Long) session.getAttributes().get(USER_ID);
        if (from == null) return;

        JsonNode msg;
        try {
            msg = jsonMapper.readTree(message.getPayload());
        } catch (JacksonException e) {
            return;
        }
        String text = msg.path("text").asString("").strip();
        long to = msg.path("to").asLong(-1);
        if (!"chat".equals(msg.path("type").asString("")) || text.isEmpty() || text.length() > MAX_TEXT || to == from) return;

        var sender = sessions.get(from);
        var target = sessions.get(to);
        boolean senderIsAdmin = Boolean.TRUE.equals(session.getAttributes().get(IS_ADMIN));
        if (target == null || !target.isOpen()
                || (!senderIsAdmin && !Boolean.TRUE.equals(target.getAttributes().get(IS_ADMIN)))) {
            if (sender != null) sender.sendMessage(json(Map.of("type", "unavailable", "from", to)));
            return;
        }

        var payload = Map.of("type", "chat", "from", from, "to", to, "text", text, "at", Instant.now().toString());
        target.sendMessage(json(payload));
        if (sender != null) sender.sendMessage(json(payload));
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        Long userId = (Long) session.getAttributes().get(USER_ID);
        if (userId == null) return;
        sessions.computeIfPresent(userId, (id, current) -> current.getDelegate() == session ? null : current);
    }

    private TextMessage json(Object payload) {
        return new TextMessage(jsonMapper.writeValueAsString(payload));
    }
}
