package cc.infoq.common.security.config;

import cc.infoq.common.security.auth.SecurityTokenService;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.context.support.AnnotationConfigWebApplicationContext;
import org.springframework.mock.web.MockServletContext;
import tools.jackson.databind.ObjectMapper;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

@Tag("dev")
class MiniappSecurityFilterChainTest {
    @Test
    void strictAuthenticationOnlyExemptsExactGetProbe() throws Exception {
        try (AnnotationConfigWebApplicationContext context = new AnnotationConfigWebApplicationContext()) {
            context.setServletContext(new MockServletContext());
            context.register(TestConfiguration.class);
            context.refresh();
            jakarta.servlet.Filter chain = context.getBean("springSecurityFilterChain", jakarta.servlet.Filter.class);
            for (String target : new String[]{"GET /auth/wechat-miniapp/enabled", "POST /auth/wechat-miniapp/enabled",
                "GET /auth/wechat-miniapp/secret", "GET /system/user/list", "GET /auth/wechat-miniapp/enabled/extra",
                "GET /resource/oss/list", "POST /resource/oss/upload", "GET /resource/oss/download/7"}) {
                String[] parts = target.split(" ", 2);
                MockHttpServletRequest request = new MockHttpServletRequest(parts[0], parts[1]);
                request.setServletPath(parts[1]);
                MockHttpServletResponse response = new MockHttpServletResponse();
                chain.doFilter(request, response, (req, res) -> ((jakarta.servlet.http.HttpServletResponse) res).setStatus(204));
                assertEquals(target.startsWith("GET /auth/wechat-miniapp/enabled") && target.endsWith("enabled") ? 204 : 401,
                    response.getStatus(), target);
            }
        }
    }

    @Configuration(proxyBeanMethods = false)
    @Import(SpringSecurityAutoConfiguration.class)
    static class TestConfiguration {
        @Bean ObjectMapper objectMapper() { return new ObjectMapper(); }
        @Bean SecurityTokenService securityTokenService() { return mock(SecurityTokenService.class); }
    }
}
