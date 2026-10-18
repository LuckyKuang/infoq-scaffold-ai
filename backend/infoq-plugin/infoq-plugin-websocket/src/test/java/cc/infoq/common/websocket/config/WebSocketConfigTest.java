package cc.infoq.common.websocket.config;

import cc.infoq.common.security.auth.SecurityTokenResolver;
import cc.infoq.common.security.auth.SecurityTokenService;
import cc.infoq.common.websocket.config.properties.WebSocketProperties;
import cc.infoq.common.websocket.handler.PlusWebSocketHandler;
import cc.infoq.common.websocket.interceptor.PlusWebSocketInterceptor;
import cc.infoq.common.websocket.listener.WebSocketClusterLifecycle;
import cc.infoq.common.websocket.listener.WebSocketTopicListener;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistration;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.web.socket.server.HandshakeInterceptor;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@Tag("dev")
class WebSocketConfigTest {

    @Test
    @DisplayName("webSocketConfigurer: should set default path and origins when blank")
    void webSocketConfigurerShouldSetDefaultsWhenBlank() {
        WebSocketConfig config = new WebSocketConfig();
        HandshakeInterceptor handshakeInterceptor = mock(HandshakeInterceptor.class);
        WebSocketHandler webSocketHandler = mock(WebSocketHandler.class);
        WebSocketProperties props = new WebSocketProperties();
        props.setPath("");
        props.setAllowedOrigins("");

        WebSocketConfigurer configurer = config.webSocketConfigurer(handshakeInterceptor, webSocketHandler, props);

        WebSocketHandlerRegistry registry = mock(WebSocketHandlerRegistry.class);
        WebSocketHandlerRegistration registration = mock(WebSocketHandlerRegistration.class);
        when(registry.addHandler(webSocketHandler, "/websocket")).thenReturn(registration);
        when(registration.addInterceptors(handshakeInterceptor)).thenReturn(registration);
        when(registration.setAllowedOrigins("*")).thenReturn(registration);

        configurer.registerWebSocketHandlers(registry);

        assertEquals("/websocket", props.getPath());
        assertEquals("*", props.getAllowedOrigins());
        verify(registry).addHandler(webSocketHandler, "/websocket");
        verify(registration).addInterceptors(handshakeInterceptor);
        verify(registration).setAllowedOrigins("*");
    }

    @Test
    @DisplayName("webSocketConfigurer: should keep custom path and origins")
    void webSocketConfigurerShouldKeepCustomValues() {
        WebSocketConfig config = new WebSocketConfig();
        HandshakeInterceptor handshakeInterceptor = mock(HandshakeInterceptor.class);
        WebSocketHandler webSocketHandler = mock(WebSocketHandler.class);
        WebSocketProperties props = new WebSocketProperties();
        props.setPath("/ws");
        props.setAllowedOrigins("https://example.com");

        WebSocketConfigurer configurer = config.webSocketConfigurer(handshakeInterceptor, webSocketHandler, props);

        WebSocketHandlerRegistry registry = mock(WebSocketHandlerRegistry.class);
        WebSocketHandlerRegistration registration = mock(WebSocketHandlerRegistration.class);
        when(registry.addHandler(webSocketHandler, "/ws")).thenReturn(registration);
        when(registration.addInterceptors(handshakeInterceptor)).thenReturn(registration);
        when(registration.setAllowedOrigins("https://example.com")).thenReturn(registration);

        configurer.registerWebSocketHandlers(registry);

        assertEquals("/ws", props.getPath());
        assertEquals("https://example.com", props.getAllowedOrigins());
    }

    @Test
    @DisplayName("bean methods: should create expected bean instances")
    void beanMethodsShouldCreateExpectedInstances() {
        WebSocketConfig config = new WebSocketConfig();

        assertInstanceOf(PlusWebSocketInterceptor.class,
            config.handshakeInterceptor(mock(SecurityTokenResolver.class), mock(SecurityTokenService.class)));
        assertInstanceOf(PlusWebSocketHandler.class, config.webSocketHandler());
        assertInstanceOf(WebSocketTopicListener.class, config.topicListener());
        assertInstanceOf(WebSocketClusterLifecycle.class, config.clusterLifecycle());
        assertNotNull(config.topicListener());
    }
}
