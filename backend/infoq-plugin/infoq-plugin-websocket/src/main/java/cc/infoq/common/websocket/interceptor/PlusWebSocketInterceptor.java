package cc.infoq.common.websocket.interceptor;

import cc.infoq.common.domain.model.LoginUser;
import cc.infoq.common.security.auth.*;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.Map;
import java.util.Optional;

import static cc.infoq.common.websocket.constant.WebSocketConstants.LOGIN_USER_KEY;

/**
 * WebSocket握手请求的拦截器
 *
 * @author Pontus
 */
@Slf4j
@RequiredArgsConstructor
public class PlusWebSocketInterceptor implements HandshakeInterceptor {

    private final SecurityTokenResolver tokenResolver;

    private final SecurityTokenService tokenService;

    /**
     * WebSocket握手之前执行的前置处理方法
     *
     * @param request    WebSocket握手请求
     * @param response   WebSocket握手响应
     * @param wsHandler  WebSocket处理程序
     * @param attributes 与WebSocket会话关联的属性
     * @return 如果允许握手继续进行，则返回true；否则返回false
     */
    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response, WebSocketHandler wsHandler, Map<String, Object> attributes) {
        Optional<SecurityResolvedToken> resolvedToken = Optional.empty();
        Optional<SecurityResolvedClientId> resolvedClientId = Optional.empty();
        try {
            HttpServletRequest servletRequest = servletRequest(request);
            resolvedToken = tokenResolver.resolve(servletRequest);
            SecurityResolvedToken token = resolvedToken
                .orElseThrow(() -> new SecurityAuthenticationException("access token is required"));
            resolvedClientId = tokenResolver.resolveClientId(servletRequest);
            SecurityResolvedClientId clientId = resolvedClientId
                .orElseThrow(() -> new SecurityAuthenticationException("request clientId is required"));
            SecurityTokenAuthentication authentication = tokenService.authenticate(token.token(), clientId.clientId());
            attributes.put(LOGIN_USER_KEY, requireLoginUser(authentication));
            return true;
        } catch (SecurityAuthenticationException e) {
            log.warn("WebSocket认证失败, path={}, tokenDigest={}, clientIdSource={}, reason={}",
                request.getURI().getPath(),
                resolvedToken.map(value -> tokenService.shortDigest(value.token())).orElse("none"),
                resolvedClientId.map(value -> value.source().name()).orElse("none"),
                e.getMessage());
            return false;
        }
    }

    /**
     * WebSocket握手成功后执行的后置处理方法
     *
     * @param request   WebSocket握手请求
     * @param response  WebSocket握手响应
     * @param wsHandler WebSocket处理程序
     * @param exception 握手过程中可能出现的异常
     */
    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response, WebSocketHandler wsHandler, Exception exception) {
        // 在这个方法中可以执行一些握手成功后的后续处理逻辑，比如记录日志或者其他操作
    }

    private HttpServletRequest servletRequest(ServerHttpRequest request) {
        if (request instanceof ServletServerHttpRequest servletServerHttpRequest) {
            return servletServerHttpRequest.getServletRequest();
        }
        throw new SecurityAuthenticationException("WebSocket request is not a servlet request");
    }

    private LoginUser requireLoginUser(SecurityTokenAuthentication authentication) {
        LoginUser loginUser = authentication.loginUser();
        if (loginUser == null || loginUser.getUserId() == null) {
            throw new SecurityAuthenticationException("LoginUser is missing from token session");
        }
        return loginUser;
    }

}
