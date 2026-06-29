package cc.infoq.common.sse.controller;

import cc.infoq.common.domain.ApiResult;
import cc.infoq.common.domain.model.LoginUser;
import cc.infoq.common.exception.SseException;
import cc.infoq.common.security.auth.*;
import cc.infoq.common.sse.core.SseEmitterManager;
import jakarta.servlet.http.HttpServletRequest;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.Optional;

/**
 * SSE 控制器
 *
 * @author Pontus
 */
@RestController
@ConditionalOnProperty(value = "sse.enabled", havingValue = "true")
@AllArgsConstructor
@Slf4j
public class SseController implements DisposableBean {

    private final SseEmitterManager sseEmitterManager;

    private final SecurityTokenResolver tokenResolver;

    private final SecurityTokenService tokenService;

    private final CurrentUserService currentUserService;

    /**
     * 建立 SSE 连接
     */
    @GetMapping(value = "${sse.path}", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter connect(HttpServletRequest request) {
        SecurityTokenAuthentication authentication = authenticate(request);
        return sseEmitterManager.connect(requireUserId(authentication), authentication.accessToken());
    }

    /**
     * 关闭 SSE 连接
     */
    @GetMapping(value = "${sse.path}/close")
    public ApiResult<Void> close() {
        SecurityTokenAuthentication authentication = currentAuthentication();
        sseEmitterManager.disconnect(requireUserId(authentication), authentication.accessToken());
        return ApiResult.ok();
    }

    /**
     * 连接资源由管理器维护，容器销毁时无需额外处理
     */
    @Override
    public void destroy() throws Exception {
    }

    private SecurityTokenAuthentication authenticate(HttpServletRequest request) {
        Optional<SecurityResolvedToken> resolvedToken = Optional.empty();
        Optional<SecurityResolvedClientId> resolvedClientId = Optional.empty();
        try {
            resolvedToken = tokenResolver.resolve(request);
            SecurityResolvedToken token = resolvedToken
                .orElseThrow(() -> new SecurityAuthenticationException("access token is required"));
            resolvedClientId = tokenResolver.resolveClientId(request);
            SecurityResolvedClientId clientId = resolvedClientId
                .orElseThrow(() -> new SecurityAuthenticationException("request clientId is required"));
            return tokenService.authenticate(token.token(), clientId.clientId());
        } catch (SecurityAuthenticationException ex) {
            log.warn("SSE认证失败, path={}, tokenDigest={}, clientIdSource={}, reason={}",
                request.getRequestURI(),
                resolvedToken.map(value -> tokenService.shortDigest(value.token())).orElse("none"),
                resolvedClientId.map(value -> value.source().name()).orElse("none"),
                ex.getMessage());
            throw new SseException("认证失败，无法访问系统资源");
        }
    }

    private SecurityTokenAuthentication currentAuthentication() {
        try {
            return currentUserService.getAuthentication();
        } catch (SecurityAuthenticationException ex) {
            log.warn("SSE关闭认证失败, reason={}", ex.getMessage());
            throw new SseException("认证失败，无法访问系统资源");
        }
    }

    private Long requireUserId(SecurityTokenAuthentication authentication) {
        LoginUser loginUser = authentication.loginUser();
        if (loginUser == null || loginUser.getUserId() == null) {
            throw new SseException("认证失败，无法访问系统资源");
        }
        return loginUser.getUserId();
    }

}
