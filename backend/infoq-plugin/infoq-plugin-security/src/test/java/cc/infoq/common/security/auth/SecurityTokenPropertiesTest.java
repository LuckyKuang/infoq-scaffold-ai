package cc.infoq.common.security.auth;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.time.Duration;

import static org.junit.jupiter.api.Assertions.*;

@Tag("dev")
class SecurityTokenPropertiesTest {

    @Test
    @DisplayName("defaults: should keep current frontend token contract")
    void defaultsShouldKeepFrontendTokenContract() {
        SecurityTokenProperties properties = new SecurityTokenProperties();

        assertEquals("Authorization", properties.getTokenName());
        assertEquals("Bearer", properties.getTokenPrefix());
        assertEquals(Duration.ofDays(30), properties.getTtl());
        assertEquals(Duration.ofSeconds(-1), properties.getActiveTimeout());
        assertTrue(properties.isQueryTokenEnabled());
        assertEquals("Authorization", properties.getQueryTokenName());
        assertEquals("clientid", properties.getClientIdHeaderName());
        assertEquals("clientid", properties.getClientIdQueryName());
    }

    @Test
    @DisplayName("secret: should fail explicitly when missing")
    void secretShouldFailExplicitlyWhenMissing() {
        SecurityTokenProperties properties = new SecurityTokenProperties();

        SecurityAuthenticationException ex = assertThrows(SecurityAuthenticationException.class, properties::requireSigningSecret);

        assertTrue(ex.getMessage().contains("security.token.secret"));
    }

    @Test
    @DisplayName("secret: should reject legacy demo token secret")
    void secretShouldRejectLegacyDemoSecret() {
        SecurityTokenProperties properties = new SecurityTokenProperties();
        properties.setSecret("abcdefghijklmnopqrstuvwxyz");

        SecurityAuthenticationException ex = assertThrows(SecurityAuthenticationException.class, properties::requireSigningSecret);

        assertTrue(ex.getMessage().contains("legacy demo token secret"));
    }

    @Test
    @DisplayName("secret: should expose only configured bytes to signer")
    void secretShouldExposeConfiguredBytesToSigner() {
        SecurityTokenProperties properties = new SecurityTokenProperties();
        properties.setSecret("  local-test-secret-value  ");

        assertArrayEquals("local-test-secret-value".getBytes(StandardCharsets.UTF_8), properties.requireSigningSecret());
    }

}
