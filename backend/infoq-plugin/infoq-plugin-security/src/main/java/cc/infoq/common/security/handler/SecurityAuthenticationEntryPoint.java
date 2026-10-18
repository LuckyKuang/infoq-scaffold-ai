package cc.infoq.common.security.handler;

import cc.infoq.common.constant.HttpStatus;
import cc.infoq.common.domain.ApiResult;
import tools.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import cc.infoq.common.security.browser.BrowserSessionCookies;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;

import java.io.IOException;

/**
 * Handles unauthenticated requests from Spring Security.
 */
@Slf4j
@RequiredArgsConstructor
public class SecurityAuthenticationEntryPoint implements AuthenticationEntryPoint {

    private static final String MESSAGE = "认证失败，无法访问系统资源";

    private final ObjectMapper objectMapper;

    private BrowserSessionCookies browserSessionCookies;

    public SecurityAuthenticationEntryPoint(ObjectMapper objectMapper, BrowserSessionCookies cookies) {
        this.objectMapper = objectMapper;
        this.browserSessionCookies = cookies;
    }

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response,
                         AuthenticationException authException) throws IOException {
        if (browserSessionCookies != null && BrowserSessionCookies.PATH.equals(request.getServletPath())) {
            browserSessionCookies.write(response, request.getHeader(BrowserSessionCookies.SCOPE_HEADER),
                request.getHeader("clientid"), "", 0);
            log.info("browser_session action={} category=bearer_rejected clientId={} requestId={}",
                request.getMethod(), request.getHeader("clientid"), request.getRequestId());
        }
        log.warn("请求地址'{}',认证失败类型'{}',无法访问系统资源",
            request.getRequestURI(), authException.getClass().getSimpleName());
        SecurityExceptionResponseWriter.write(response, objectMapper,
            ApiResult.fail(HttpStatus.UNAUTHORIZED, MESSAGE));
    }
}
