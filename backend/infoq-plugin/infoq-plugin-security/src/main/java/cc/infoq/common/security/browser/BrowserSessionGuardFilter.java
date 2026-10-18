package cc.infoq.common.security.browser;

import cc.infoq.common.domain.ApiResult;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.redisson.client.RedisException;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.filter.OncePerRequestFilter;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Set;

@Slf4j
public class BrowserSessionGuardFilter extends OncePerRequestFilter {
    private final BrowserSessionProperties properties;
    private final BrowserSessionCookies cookies;
    private final ObjectMapper objectMapper;

    public BrowserSessionGuardFilter(BrowserSessionProperties properties, BrowserSessionCookies cookies, ObjectMapper objectMapper) {
        this.properties = properties;
        this.cookies = cookies;
        this.objectMapper = objectMapper;
    }

    public static boolean isResource(HttpServletRequest request) {
        String path = request.getServletPath();
        return BrowserSessionCookies.PATH.equals(path) || (BrowserSessionCookies.PATH + "/csrf").equals(path);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !isResource(request);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
        throws ServletException, IOException {
        response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
        response.setHeader(HttpHeaders.PRAGMA, "no-cache");
        String scope = request.getHeader(BrowserSessionCookies.SCOPE_HEADER);
        String clientId = request.getHeader("clientid");
        if (!Set.of("react", "vue").contains(scope == null ? "" : scope)) {
            fail(request, response, 403, "scope_rejected");
            return;
        }
        String origin = request.getHeader(HttpHeaders.ORIGIN);
        boolean csrfGet = "GET".equals(request.getMethod()) && request.getServletPath().endsWith("/csrf");
        boolean validOrigin;
        try {
            validOrigin = origin == null ? csrfGet && "same-origin".equals(request.getHeader("Sec-Fetch-Site"))
                : properties.getAllowedOrigins().contains(BrowserSessionProperties.normalizeOrigin(origin));
        } catch (IllegalArgumentException exception) {
            validOrigin = false;
        }
        if (!validOrigin || "cross-site".equals(request.getHeader("Sec-Fetch-Site"))) {
            fail(request, response, 403, "origin_rejected");
            return;
        }
        if (clientId == null || !clientId.matches("[A-Za-z0-9][A-Za-z0-9._-]{0,127}")) {
            fail(request, response, 400, "invalid_client_id");
            return;
        }
        try {
            chain.doFilter(request, response);
        } catch (RedisException | DataAccessException exception) {
            if ("DELETE".equals(request.getMethod())) {
                cookies.write(response, scope, clientId, "", 0);
            }
            fail(request, response, 503, "dependency_unavailable");
        }
    }

    private void fail(HttpServletRequest request, HttpServletResponse response, int status, String category) throws IOException {
        log.info("browser_session action={} category={} clientId={} requestId={}", request.getMethod(), category,
            safeClientId(request.getHeader("clientid")), request.getRequestId());
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        objectMapper.writeValue(response.getWriter(), ApiResult.fail(status, category));
    }

    private String safeClientId(String clientId) {
        return clientId != null && clientId.matches("[A-Za-z0-9][A-Za-z0-9._-]{0,127}") ? clientId : "invalid";
    }
}
