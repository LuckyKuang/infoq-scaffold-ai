package cc.infoq.common.websocket.config;

import cc.infoq.common.security.auth.SecurityTokenResolver;
import cc.infoq.common.security.auth.SecurityTokenService;
import cc.infoq.common.websocket.config.properties.WebSocketProperties;
import cc.infoq.common.websocket.handler.PlusWebSocketHandler;
import cc.infoq.common.websocket.interceptor.PlusWebSocketInterceptor;
import cc.infoq.common.websocket.listener.WebSocketClusterLifecycle;
import cc.infoq.common.websocket.listener.WebSocketTopicListener;
import cn.hutool.core.util.StrUtil;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.server.HandshakeInterceptor;

/**
 * WebSocket 配置
 *
 * @author Pontus
 */
@AutoConfiguration
@ConditionalOnProperty(value = "websocket.enabled", havingValue = "true")
@EnableConfigurationProperties(WebSocketProperties.class)
@EnableWebSocket
public class WebSocketConfig {

    @Bean
    public WebSocketConfigurer webSocketConfigurer(HandshakeInterceptor handshakeInterceptor,
                                                   WebSocketHandler webSocketHandler, WebSocketProperties webSocketProperties) {
        // 如果WebSocket的路径为空，则设置默认路径为 "/websocket"
        if (StrUtil.isBlank(webSocketProperties.getPath())) {
            webSocketProperties.setPath("/websocket");
        }

        // 如果允许跨域访问的地址为空，则设置为 "*"，表示允许所有来源的跨域请求
        if (StrUtil.isBlank(webSocketProperties.getAllowedOrigins())) {
            webSocketProperties.setAllowedOrigins("*");
        }

        // 返回一个WebSocketConfigurer对象，用于配置WebSocket
        return registry -> registry
            // 添加WebSocket处理程序和拦截器到指定路径，设置允许的跨域来源
            .addHandler(webSocketHandler, webSocketProperties.getPath())
            .addInterceptors(handshakeInterceptor)
            .setAllowedOrigins(webSocketProperties.getAllowedOrigins());
    }

    @Bean
    public HandshakeInterceptor handshakeInterceptor(SecurityTokenResolver tokenResolver, SecurityTokenService tokenService) {
        return new PlusWebSocketInterceptor(tokenResolver, tokenService);
    }

    @Bean
    public WebSocketHandler webSocketHandler() {
        return new PlusWebSocketHandler();
    }

    @Bean
    public WebSocketTopicListener topicListener() {
        return new WebSocketTopicListener();
    }

    @Bean
    public WebSocketClusterLifecycle clusterLifecycle() {
        return new WebSocketClusterLifecycle();
    }
}
