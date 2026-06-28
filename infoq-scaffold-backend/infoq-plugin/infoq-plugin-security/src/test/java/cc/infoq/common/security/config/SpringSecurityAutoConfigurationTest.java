package cc.infoq.common.security.config;

import cc.infoq.common.security.config.properties.SecurityProperties;
import cc.infoq.common.security.config.properties.SseProperties;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Tag("dev")
class SpringSecurityAutoConfigurationTest {

    @Test
    @DisplayName("resolvePublicMatchers: should merge configured excludes and default public paths")
    void resolvePublicMatchersShouldMergeConfiguredExcludesAndDefaults() {
        SecurityProperties properties = new SecurityProperties();
        properties.setExcludes(new String[]{"/public/**", "", null, "/doc.html"});

        List<String> matchers = SpringSecurityAutoConfiguration.resolvePublicMatchers(properties);

        assertTrue(matchers.contains("/public/**"));
        assertTrue(matchers.contains("/auth/login"));
        assertTrue(matchers.contains("/auth/code"));
        assertTrue(matchers.contains("/auth/register"));
        assertTrue(matchers.contains("/auth/forgot-password"));
        assertTrue(matchers.contains(SecurityConfig.HEALTH_CHECK_PATH));
        assertTrue(matchers.contains(SecurityConfig.HEALTH_CHECK_PATTERN));
        assertTrue(matchers.contains("/doc.html"));
        assertTrue(matchers.contains("/resource/sse"));
        assertFalse(matchers.contains(""));
    }

    @Test
    @DisplayName("resolvePublicMatchers: should not expose logout or sse close as public paths")
    void resolvePublicMatchersShouldNotExposeAuthenticatedEndpoints() {
        SecurityProperties properties = new SecurityProperties();
        properties.setExcludes(new String[]{"/public/**"});

        List<String> matchers = SpringSecurityAutoConfiguration.resolvePublicMatchers(properties);

        assertFalse(matchers.contains("/auth/logout"));
        assertFalse(matchers.contains("/resource/sse/close"));
    }

    @Test
    @DisplayName("resolvePublicMatchers: should expose configured sse connect path only")
    void resolvePublicMatchersShouldExposeConfiguredSseConnectPathOnly() {
        SecurityProperties properties = new SecurityProperties();
        SseProperties sseProperties = new SseProperties();
        sseProperties.setPath("/events/connect");

        List<String> matchers = SpringSecurityAutoConfiguration.resolvePublicMatchers(properties, sseProperties);

        assertTrue(matchers.contains("/events/connect"));
        assertFalse(matchers.contains("/events/connect/close"));
    }

    @Test
    @DisplayName("strictAuthentication: should be enabled unless explicitly disabled")
    void strictAuthenticationShouldDefaultToTrue() {
        assertTrue(SpringSecurityAutoConfiguration.isStrictAuthentication(new MockEnvironment()));
        assertFalse(SpringSecurityAutoConfiguration.isStrictAuthentication(new MockEnvironment()
            .withProperty(SpringSecurityAutoConfiguration.STRICT_AUTHENTICATION_PROPERTY, "false")));
    }
}
