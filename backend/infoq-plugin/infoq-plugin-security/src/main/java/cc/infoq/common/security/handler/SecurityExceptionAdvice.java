package cc.infoq.common.security.handler;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.io.IOException;

/**
 * 方法级鉴权（@PreAuthorize、CurrentUserService 等）在 MVC 内抛出的安全异常不会回到过滤器链，
 * 需先于全局 RuntimeException 处理器拦截，复用过滤器链的 401/403 响应语义。
 */
@RestControllerAdvice
@Order(Ordered.HIGHEST_PRECEDENCE)
@RequiredArgsConstructor
public class SecurityExceptionAdvice {

    private final SecurityAuthenticationEntryPoint authenticationEntryPoint;

    private final SecurityAccessDeniedHandler accessDeniedHandler;

    @ExceptionHandler(AuthenticationException.class)
    public void handleAuthenticationException(AuthenticationException e, HttpServletRequest request,
                                              HttpServletResponse response) throws IOException {
        authenticationEntryPoint.commence(request, response, e);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public void handleAccessDeniedException(AccessDeniedException e, HttpServletRequest request,
                                            HttpServletResponse response) throws IOException {
        accessDeniedHandler.handle(request, response, e);
    }
}
