package com.sdoc.sdoc.signaling;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.web.socket.server.standard.ServletServerContainerFactoryBean;

import java.util.Arrays;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {
    public static final String PATH = "/api/v1/signal";

    private final SignalingHandler handler;
    private final RemoteRelayHandler relay;
    private final String[] allowedOrigins;

    public WebSocketConfig(SignalingHandler handler, RemoteRelayHandler relay, @Value("${cors.allowed-origins}") String origins) {
        this.handler = handler;
        this.relay = relay;
        this.allowedOrigins = Arrays.stream(origins.split(","))
                .map(String::trim).filter(s -> !s.isBlank()).toArray(String[]::new);
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(handler, PATH).setAllowedOrigins(allowedOrigins);
        registry.addHandler(relay, RemoteRelayHandler.AGENT_PATH, RemoteRelayHandler.VIEWER_PATH).setAllowedOrigins(allowedOrigins);
    }

    @Bean
    public ServletServerContainerFactoryBean webSocketContainer() {
        var container = new ServletServerContainerFactoryBean();
        container.setMaxTextMessageBufferSize(64 * 1024);
        container.setMaxBinaryMessageBufferSize(2 * 1024 * 1024);
        return container;
    }
}