package cc.infoq.common.security.handler;

import cc.infoq.common.constant.HttpStatus;
import cc.infoq.common.domain.ApiResult;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;

import java.io.IOException;

/**
 * Handles authorized users that lack a required permission.
 */
@Slf4j
@RequiredArgsConstructor
public class SecurityAccessDeniedHandler implements AccessDeniedHandler {

    private static final String MESSAGE = "没有访问权限，请联系管理员授权";

    private final ObjectMapper objectMapper;

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response,
                       AccessDeniedException accessDeniedException) throws IOException {
        log.warn("请求地址'{}',权限校验失败类型'{}'",
            request.getRequestURI(), accessDeniedException.getClass().getSimpleName());
        SecurityExceptionResponseWriter.write(response, objectMapper,
            ApiResult.fail(HttpStatus.FORBIDDEN, MESSAGE));
    }
}
