package cc.infoq.system.controller.login;

import cc.infoq.common.domain.model.LoginUser;
import cc.infoq.common.security.auth.CurrentUserService;
import cc.infoq.common.security.auth.SecurityTokenAuthentication;
import cc.infoq.common.security.auth.SecurityTokenSession;
import cc.infoq.common.security.browser.*;
import cc.infoq.system.service.SysLoginService;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.redisson.client.RedisException;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.web.csrf.DefaultCsrfToken;
import tools.jackson.databind.ObjectMapper;

import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@Tag("dev")
class BrowserSessionControllerTest {
    private final BrowserSessionService service = mock(BrowserSessionService.class);
    private final CurrentUserService users = mock(CurrentUserService.class);
    private final SysLoginService login = mock(SysLoginService.class);
    private final BrowserSessionProperties properties = production();
    private final BrowserSessionCookies cookies = new BrowserSessionCookies(properties);
    private final BrowserSessionCsrfRepository csrf = new BrowserSessionCsrfRepository(properties);
    private final BrowserSessionController controller = new BrowserSessionController(service, cookies, csrf, users, login);

    @Test
    void csrfBootstrapReturnsFrameworkTokenAndHeaderName() {
        var request = request("GET");
        request.setAttribute(CsrfToken.class.getName(), new DefaultCsrfToken("X-XSRF-TOKEN", "_csrf", "csrf-value"));
        var result = controller.csrf(request);
        assertEquals(200, result.getCode());
        assertEquals("csrf-value", result.getData().get("token"));
        assertEquals("X-XSRF-TOKEN", result.getData().get("headerName"));
        verifyNoInteractions(service, users, login);
    }

    @Test
    void recoveryPayloadUsesExistingLoginVoJsonFieldsAndNoRefreshToken() {
        var request = request("POST");
        request.setCookies(new Cookie(cookies.name("react", "pc"), "handle"));
        var session = new SecurityTokenSession();
        var authentication = new SecurityTokenAuthentication("existing-token", "a".repeat(64), null, session);
        when(service.restore("handle", "pc", "react")).thenReturn(new BrowserSessionService.Restored(authentication, 321));
        var result = controller.restore(request);
        var json = new ObjectMapper().valueToTree(result).path("data");
        assertEquals("existing-token", json.path("access_token").asText());
        assertEquals(321, json.path("expire_in").asLong());
        assertEquals("pc", json.path("client_id").asText());
        assertTrue(json.path("refresh_token").isMissingNode() || json.path("refresh_token").isNull());
        verifyNoInteractions(users, login);
    }

    @Test
    void productionCookiePolicyIgnoresUntrustedForwardedHeadersAndUsesExactExternalPath() {
        var request = request("PUT");
        request.setSecure(false);
        request.addHeader("X-Forwarded-Proto", "http");
        var response = new MockHttpServletResponse();
        var session = new SecurityTokenSession();
        var authentication = new SecurityTokenAuthentication("existing-token", "a".repeat(64), null, session);
        when(users.getAuthentication()).thenReturn(authentication);
        when(service.bind(authentication, "pc", "react", null)).thenReturn(new BrowserSessionService.Created("opaque-handle", 50));
        assertEquals(200, controller.bind(request, response).getCode());
        String value = response.getHeader("Set-Cookie");
        assertTrue(value.startsWith("__Secure-InfoQ-BS-react-"));
        assertTrue(value.contains("Secure") && value.contains("HttpOnly") && value.contains("SameSite=Strict"));
        assertTrue(value.contains("Path=/prod-api/auth/browser-session") && value.contains("Max-Age=50"));
        assertFalse(value.contains("Domain="));
    }

    @Test
    void dependencyFailureDoesNotPretendAnonymousButDeleteAlwaysClearsBothCookies() {
        var response = new MockHttpServletResponse();
        assertEquals(503, controller.failure(new RedisException("dependency details must remain private"), request("POST"), response).getCode());
        assertTrue(response.getHeaders("Set-Cookie").isEmpty());
        response = new MockHttpServletResponse();
        var result = controller.failure(new RedisException("dependency details must remain private"), request("DELETE"), response);
        assertEquals(503, result.getCode());
        assertEquals(503, response.getStatus());
        assertEquals("dependency_unavailable", result.getMsg());
        assertEquals(2, response.getHeaders("Set-Cookie").size());
        for (String cookie : response.getHeaders("Set-Cookie")) {
            assertTrue(cookie.contains("Max-Age=0") && cookie.contains("Path=/prod-api/auth/browser-session"));
        }
    }

    @Test
    void unauthorizedClearsCurrentScopeCookiesAndForbiddenCannotForceLogout() {
        var response = new MockHttpServletResponse();
        controller.failure(new BrowserSessionException(401, "revoked"), request("POST"), response);
        assertEquals(2, response.getHeaders("Set-Cookie").size());
        assertTrue(response.getHeaders("Set-Cookie").stream().noneMatch(cookie -> cookie.contains("vue")));
        response = new MockHttpServletResponse();
        controller.failure(new BrowserSessionException(403, "csrf_rejected"), request("POST"), response);
        assertTrue(response.getHeaders("Set-Cookie").isEmpty());
    }

    private MockHttpServletRequest request(String method) {
        var request = new MockHttpServletRequest(method, BrowserSessionCookies.PATH);
        request.setServletPath(BrowserSessionCookies.PATH);
        request.addHeader("clientid", "pc");
        request.addHeader(BrowserSessionCookies.SCOPE_HEADER, "react");
        return request;
    }

    private BrowserSessionProperties production() {
        var properties = new BrowserSessionProperties();
        properties.setDeploymentMode("production");
        properties.setPublicBaseUrl("https://admin.example.com");
        properties.setOrigins(List.of());
        properties.setSecure(true);
        properties.setCookiePath("/prod-api/auth/browser-session");
        properties.afterPropertiesSet();
        return properties;
    }
}
