package cc.infoq.system.controller.login;

import cc.infoq.common.domain.model.LoginUser;
import cc.infoq.common.security.auth.*;
import cc.infoq.common.security.browser.*;
import cc.infoq.common.security.config.SpringSecurityAutoConfiguration;
import cc.infoq.common.web.config.ResourcesConfig;
import cc.infoq.system.service.SysLoginService;
import jakarta.servlet.Filter;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.*;
import org.redisson.client.RedisException;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockCookie;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockServletContext;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.support.AnnotationConfigWebApplicationContext;
import org.springframework.web.filter.CorsFilter;
import tools.jackson.databind.ObjectMapper;

import java.time.Duration;
import java.util.*;
import java.util.concurrent.CompletableFuture;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;

@Tag("dev")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class BrowserSessionSecurityFilterChainTest {
    private AnnotationConfigWebApplicationContext context;
    private MockMvc mvc;
    private ObjectMapper mapper;
    private MemoryBindings bindings;
    private MemoryTokens tokens;
    private SecurityTokenService tokenService;

    @BeforeAll
    void setup() {
        context = new AnnotationConfigWebApplicationContext();
        context.setServletContext(new MockServletContext());
        context.register(TestConfiguration.class);
        context.refresh();
        new cc.infoq.common.utils.SpringUtils().setApplicationContext(context);
        mapper = context.getBean(ObjectMapper.class);
        bindings = (MemoryBindings) context.getBean(BrowserSessionStore.class);
        tokens = (MemoryTokens) context.getBean(SecurityTokenStore.class);
        tokenService = context.getBean(SecurityTokenService.class);
        mvc = MockMvcBuilders.standaloneSetup(context.getBean(BrowserSessionController.class))
            .addFilters(context.getBean(CorsFilter.class), context.getBean("springSecurityFilterChain", Filter.class)).build();
    }

    @BeforeEach
    void resetState() {
        bindings.values.clear();
        bindings.fail = false;
        tokens.values.clear();
        reset(context.getBean(SysLoginService.class));
    }

    @AfterAll
    void close() {
        context.close();
    }

    @Test
    void actualLoginBindRefreshAndLogoutKeepOriginalBearerContract() throws Exception {
        var csrf = csrf("react");
        String bearer = issue();
        var bound = perform(put(BrowserSessionCookies.PATH).header("Authorization", "Bearer " + bearer), "react", csrf, null);
        assertEquals(200, bound.getStatus());
        Cookie handle = recoveryCookie(bound);
        String header = bound.getHeaders("Set-Cookie").stream().filter(value -> value.startsWith(handle.getName() + "=")).findFirst().orElseThrow();
        assertTrue(header.contains("Path=/dev-api/auth/browser-session"));
        assertTrue(header.contains("HttpOnly") && header.contains("SameSite=Strict"), header.substring(header.indexOf(';')));
        assertFalse(header.contains("Domain="));
        assertFalse(bound.getHeaders("Set-Cookie").stream().anyMatch(value -> value.startsWith("InfoQ-CSRF-") && value.contains("Max-Age=0")),
            "binding a stateless Bearer must not invalidate the SPA's CSRF bootstrap");
        var restored = perform(post(BrowserSessionCookies.PATH), "react", csrf, handle);
        assertEquals(200, restored.getStatus());
        var data = mapper.readTree(restored.getContentAsString()).path("data");
        assertEquals(bearer, data.path("access_token").asText());
        assertEquals("pc", data.path("client_id").asText());
        assertTrue(data.path("expire_in").asLong() > 0);
        assertTrue(data.path("refresh_token").isMissingNode() || data.path("refresh_token").isNull());
        assertNull(restored.getHeader("Set-Cookie"), "restore must not renew cookies or TTL");
        assertEquals("no-store", restored.getHeader("Cache-Control"));
        assertEquals(401, mvc.perform(get("/system/user/getInfo").cookie(handle)
            .with(request -> { request.setServletPath("/system/user/getInfo"); return request; }))
            .andReturn().getResponse().getStatus());
        var removed = perform(delete(BrowserSessionCookies.PATH), "react", csrf, handle);
        assertEquals(200, removed.getStatus());
        assertTrue(removed.getHeaders("Set-Cookie").stream().allMatch(value -> value.contains("Max-Age=0")));
        verify(context.getBean(SysLoginService.class)).recordLoginInfo(eq("admin"), eq("Logout"), anyString());
        var nextCsrf = csrf("react");
        assertEquals(401, perform(post(BrowserSessionCookies.PATH), "react", nextCsrf, handle).getStatus());
        assertTrue(tokens.values.isEmpty());
    }

    @Test
    void missingWrongOrParameterCsrfFailsBeforeSessionSideEffects() throws Exception {
        var csrf = csrf("react");
        String bearer = issue();
        for (String value : List.of("", "wrong")) {
            var response = mvc.perform(base(put(BrowserSessionCookies.PATH).header("Authorization", "Bearer " + bearer)
                .cookie(csrf.cookie()).param("_csrf", csrf.token()).header("X-XSRF-TOKEN", value), "react"))
                .andReturn().getResponse();
            assertEquals(403, response.getStatus());
            assertTrue(response.getHeaders("Set-Cookie").isEmpty(), "CSRF rejection must not log out an existing browser");
        }
        assertTrue(bindings.values.isEmpty());
    }

    @Test
    void onlyExplicitHeaderBearerCanBindAndCookieNeverAuthenticatesBusinessApi() throws Exception {
        var csrf = csrf("react");
        var response = perform(put(BrowserSessionCookies.PATH).param("Authorization", "Bearer " + issue()), "react", csrf, null);
        assertEquals(401, response.getStatus());
        assertTrue(bindings.values.isEmpty());
        assertEquals(401, perform(put(BrowserSessionCookies.PATH).header("Authorization", "Bearer invalid"), "react", csrf, null).getStatus());
    }

    @Test
    void originAndBootstrapHeaderAreMandatoryAndNeverTrustForwardedHeaders() throws Exception {
        for (String value : List.of("null", "http://localhost.evil", "http://localhost:81", "http://localhost@evil.example", "http://*.localhost")) {
            var response = mvc.perform(get(BrowserSessionCookies.PATH + "/csrf").header("Origin", value)
                .header("clientid", "pc").header(BrowserSessionCookies.SCOPE_HEADER, "react")
                .header("X-Forwarded-Host", "localhost").header("X-Forwarded-Proto", "http")
                .with(request -> { request.setServletPath(BrowserSessionCookies.PATH + "/csrf"); return request; }))
                .andReturn().getResponse();
            assertEquals(403, response.getStatus(), value);
            assertTrue(response.getHeaders("Set-Cookie").isEmpty());
        }
        var missing = mvc.perform(get(BrowserSessionCookies.PATH + "/csrf").header("clientid", "pc")
            .header(BrowserSessionCookies.SCOPE_HEADER, "react")
            .with(request -> { request.setServletPath(BrowserSessionCookies.PATH + "/csrf"); return request; })).andReturn().getResponse();
        assertEquals(403, missing.getStatus());
        var sameOriginFetch = mvc.perform(get(BrowserSessionCookies.PATH + "/csrf").header("clientid", "pc")
            .header(BrowserSessionCookies.SCOPE_HEADER, "react").header("Sec-Fetch-Site", "same-origin")
            .with(request -> { request.setServletPath(BrowserSessionCookies.PATH + "/csrf"); return request; })).andReturn().getResponse();
        assertEquals(200, sameOriginFetch.getStatus());
        assertEquals(403, mvc.perform(get(BrowserSessionCookies.PATH + "/csrf").header("Origin", "http://localhost")
            .header("clientid", "pc").with(request -> { request.setServletPath(BrowserSessionCookies.PATH + "/csrf"); return request; }))
            .andReturn().getResponse().getStatus());
    }

    @Test
    void strictCorsPreflightDoesNotRequireActualScopeHeaderOrCreateSession() throws Exception {
        var response = mvc.perform(options(BrowserSessionCookies.PATH).header("Origin", "http://localhost")
            .header("Access-Control-Request-Method", "PUT")
            .header("Access-Control-Request-Headers", "clientid,x-infoq-browser-session,x-xsrf-token,authorization")
            .with(request -> { request.setServletPath(BrowserSessionCookies.PATH); request.setServerName("backend.internal"); return request; })).andReturn().getResponse();
        assertEquals(200, response.getStatus());
        assertEquals("http://localhost", response.getHeader("Access-Control-Allow-Origin"));
        assertTrue(response.getHeaders("Set-Cookie").isEmpty());
        assertTrue(bindings.values.isEmpty());
    }

    @Test
    void missingCookiesAre401MalformedClientIs400AndDeleteIsIdempotent() throws Exception {
        var csrf = csrf("react");
        var response = perform(post(BrowserSessionCookies.PATH), "react", csrf, null);
        assertEquals(401, response.getStatus());
        assertTrue(response.getHeaders("Set-Cookie").stream().allMatch(value -> value.contains("Max-Age=0")));
        assertEquals(200, perform(delete(BrowserSessionCookies.PATH), "react", csrf, null).getStatus());
        var invalid = base(get(BrowserSessionCookies.PATH + "/csrf"), "react").header("clientid", "bad client");
        invalid.with(request -> { request.removeHeader("clientid"); request.addHeader("clientid", "bad client"); return request; });
        assertEquals(400, mvc.perform(invalid).andReturn().getResponse().getStatus());
    }

    @Test
    void dependenciesReturn503AndDeleteClearsBrowserWithoutPretendingServerRevocation() throws Exception {
        var csrf = csrf("react");
        var bound = perform(put(BrowserSessionCookies.PATH).header("Authorization", "Bearer " + issue()), "react", csrf, null);
        var cookie = recoveryCookie(bound);
        bindings.fail = true;
        var restored = perform(post(BrowserSessionCookies.PATH), "react", csrf, cookie);
        assertEquals(503, restored.getStatus());
        assertTrue(restored.getHeaders("Set-Cookie").isEmpty(), "dependency failure is not an anonymous session");
        var deleted = perform(delete(BrowserSessionCookies.PATH), "react", csrf, cookie);
        assertEquals(503, deleted.getStatus());
        assertTrue(deleted.getHeaders("Set-Cookie").stream().allMatch(value -> value.contains("Max-Age=0")));
        verifyNoInteractions(context.getBean(SysLoginService.class));
    }

    @Test
    void reactAndVueCsrfRepositoriesAndRecoveryCookiesRemainIsolatedUnderConcurrentBootstrap() {
        List<CompletableFuture<Void>> requests = new ArrayList<>();
        for (int i = 0; i < 12; i++) {
            String scope = i % 2 == 0 ? "react" : "vue";
            requests.add(CompletableFuture.runAsync(() -> {
                try {
                    assertEquals("InfoQ-CSRF-" + scope, csrf(scope).cookie().getName());
                } catch (Exception exception) {
                    throw new AssertionError(exception);
                }
            }));
        }
        CompletableFuture.allOf(requests.toArray(CompletableFuture[]::new)).join();
        var cookies = context.getBean(BrowserSessionCookies.class);
        assertNotEquals(cookies.name("react", "pc"), cookies.name("vue", "pc"));
        assertNotEquals(cookies.name("react", "pc"), cookies.name("react", "other"));
    }

    private Csrf csrf(String scope) throws Exception {
        var response = mvc.perform(base(get(BrowserSessionCookies.PATH + "/csrf"), scope)).andReturn().getResponse();
        assertEquals(200, response.getStatus());
        var token = mapper.readTree(response.getContentAsString()).path("data").path("token").asText();
        assertFalse(token.isEmpty());
        var cookie = response.getCookie("InfoQ-CSRF-" + scope);
        assertNotNull(cookie);
        assertTrue(cookie.isHttpOnly());
        assertEquals("Strict", cookie.getAttribute("SameSite"));
        return new Csrf(token, cookie);
    }

    private MockHttpServletResponse perform(MockHttpServletRequestBuilder builder, String scope, Csrf csrf, Cookie recovery) throws Exception {
        builder.cookie(csrf.cookie()).header("X-XSRF-TOKEN", csrf.token());
        if (recovery != null) builder.cookie(recovery);
        return mvc.perform(base(builder, scope)).andReturn().getResponse();
    }

    private MockHttpServletRequestBuilder base(MockHttpServletRequestBuilder builder, String scope) {
        return builder.header("Origin", "http://localhost").header("clientid", "pc")
            .header(BrowserSessionCookies.SCOPE_HEADER, scope)
            .with(request -> { request.setServletPath(request.getRequestURI()); return request; });
    }

    private Cookie recoveryCookie(MockHttpServletResponse response) {
        return response.getHeaders("Set-Cookie").stream().filter(value -> value.startsWith("InfoQ-BS-"))
            .map(MockCookie::parse).findFirst().orElseThrow();
    }

    private String issue() {
        LoginUser user = new LoginUser();
        user.setUserId(1L); user.setUserType("sys_user"); user.setUsername("admin");
        return tokenService.issue(new SecurityTokenIssueRequest(user, "pc", "pc", 3600L, -1L, null)).accessToken();
    }

    private record Csrf(String token, Cookie cookie) { }

    static class MemoryBindings extends BrowserSessionStore {
        final Map<String, Binding> values = new HashMap<>();
        boolean fail;
        @Override public Binding find(String handle) { if (fail) throw new RedisException("isolated test failure"); return values.get(handle); }
        @Override public void save(String handle, Binding value, Duration ttl) { values.put(handle, value); }
        @Override public void delete(String handle) { values.remove(handle); }
    }

    static class MemoryTokens extends SecurityTokenStore {
        final Map<String, SecurityTokenSession> values = new HashMap<>();
        @Override public void save(String token, SecurityTokenSession value) { values.put(value.getTokenDigest(), value); }
        @Override public Optional<SecurityTokenSession> findByDigest(String digest) { return Optional.ofNullable(values.get(digest)); }
        @Override public boolean revoke(String token, String digest) { return values.remove(digest) != null; }
    }

    @Configuration(proxyBeanMethods = false)
    @Import({SpringSecurityAutoConfiguration.class, ResourcesConfig.class})
    static class TestConfiguration {
        @Bean ObjectMapper objectMapper() { return new ObjectMapper(); }
        @Bean BrowserSessionStore browserSessionStore() { return new MemoryBindings(); }
        @Bean SecurityTokenStore securityTokenStore() { return new MemoryTokens(); }
        @Bean SecurityTokenService securityTokenService(SecurityTokenProperties properties, SecurityTokenStore store) {
            properties.setSecret("isolated-browser-session-unit-test-secret");
            return new SecurityTokenService(properties, store);
        }
        @Bean SysLoginService loginService() { return mock(SysLoginService.class); }
        @Bean BrowserSessionController browserSessionController(BrowserSessionService service, BrowserSessionCookies cookies,
            BrowserSessionCsrfRepository csrf, CurrentUserService users, SysLoginService login) {
            return new BrowserSessionController(service, cookies, csrf, users, login);
        }
    }
}
