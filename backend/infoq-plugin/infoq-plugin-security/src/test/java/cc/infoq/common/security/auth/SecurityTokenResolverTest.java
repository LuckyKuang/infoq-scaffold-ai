package cc.infoq.common.security.auth;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

@Tag("dev")
class SecurityTokenResolverTest {

    @Test
    @DisplayName("resolve: should read Authorization bearer header")
    void resolveShouldReadAuthorizationBearerHeader() {
        SecurityTokenResolver resolver = new SecurityTokenResolver(new SecurityTokenProperties());
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer access-token");

        Optional<SecurityResolvedToken> resolved = resolver.resolve(request);

        assertTrue(resolved.isPresent());
        assertEquals("access-token", resolved.get().token());
        assertEquals(SecurityTokenSource.HEADER, resolved.get().source());
    }

    @Test
    @DisplayName("resolve: should use query token when enabled and header is absent")
    void resolveShouldUseQueryTokenWhenEnabled() {
        SecurityTokenResolver resolver = new SecurityTokenResolver(new SecurityTokenProperties());
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addParameter("Authorization", "Bearer query-token");

        Optional<SecurityResolvedToken> resolved = resolver.resolve(request);

        assertTrue(resolved.isPresent());
        assertEquals("query-token", resolved.get().token());
        assertEquals(SecurityTokenSource.QUERY, resolved.get().source());
    }

    @Test
    @DisplayName("resolve: should not use query token when disabled")
    void resolveShouldNotUseQueryTokenWhenDisabled() {
        SecurityTokenProperties properties = new SecurityTokenProperties();
        properties.setQueryTokenEnabled(false);
        SecurityTokenResolver resolver = new SecurityTokenResolver(properties);
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addParameter("Authorization", "Bearer query-token");

        assertTrue(resolver.resolve(request).isEmpty());
    }

    @Test
    @DisplayName("resolve: should reject malformed bearer prefix")
    void resolveShouldRejectMalformedBearerPrefix() {
        SecurityTokenResolver resolver = new SecurityTokenResolver(new SecurityTokenProperties());
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Beareraccess-token");

        assertThrows(SecurityAuthenticationException.class, () -> resolver.resolve(request));
    }

    @Test
    @DisplayName("clientId: should prefer header over query")
    void clientIdShouldPreferHeaderOverQuery() {
        SecurityTokenResolver resolver = new SecurityTokenResolver(new SecurityTokenProperties());
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("clientid", "header-client");
        request.addParameter("clientid", "query-client");

        Optional<SecurityResolvedClientId> resolved = resolver.resolveClientId(request);

        assertTrue(resolved.isPresent());
        assertEquals("header-client", resolved.get().clientId());
        assertEquals(SecurityTokenSource.HEADER, resolved.get().source());
    }

}
