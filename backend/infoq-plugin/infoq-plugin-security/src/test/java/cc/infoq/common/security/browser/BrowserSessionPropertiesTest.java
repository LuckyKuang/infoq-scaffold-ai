package cc.infoq.common.security.browser;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

@Tag("dev")
class BrowserSessionPropertiesTest {
    @Test
    void productionOnlyUsesControlledHttpsOriginAndSecureExternalCookiePath() {
        var properties = production();
        properties.afterPropertiesSet();
        assertEquals(java.util.Set.of("https://admin.example.com"), properties.getAllowedOrigins());
        properties.setOrigins(List.of("https://other.example.com"));
        assertThrows(IllegalArgumentException.class, properties::afterPropertiesSet);
        properties.setOrigins(List.of());
        properties.setSecure(false);
        assertThrows(IllegalArgumentException.class, properties::afterPropertiesSet);
        properties.setSecure(true);
        properties.setPublicBaseUrl("http://admin.example.com");
        assertThrows(IllegalArgumentException.class, properties::afterPropertiesSet);
        properties.setPublicBaseUrl("https://admin.example.com/path");
        assertThrows(IllegalArgumentException.class, properties::afterPropertiesSet);
    }

    @Test
    void developmentRequiresExplicitLoopbackOriginsAndBoundedTtl() {
        var properties = new BrowserSessionProperties();
        properties.setOrigins(List.of("http://app.localhost", "http://localhost:5173/", "http://[::1]:80"));
        properties.afterPropertiesSet();
        for (String invalid : List.of("http://evil-localhost", "http://localhost.evil", "http://localtest.me", "http://*.localhost", "null", "http://localhost/path")) {
            properties.setOrigins(List.of(invalid));
            assertThrows(IllegalArgumentException.class, properties::afterPropertiesSet, invalid);
        }
        properties.setOrigins(List.of("http://localhost"));
        for (long invalid : new long[]{0, -1, 2592001}) {
            properties.setTtlSeconds(invalid);
            assertThrows(IllegalArgumentException.class, properties::afterPropertiesSet);
        }
        properties.setTtlSeconds(30);
        properties.setCookiePath("/auth/browser-session");
        assertThrows(IllegalArgumentException.class, properties::afterPropertiesSet);
    }

    private BrowserSessionProperties production() {
        var properties = new BrowserSessionProperties();
        properties.setDeploymentMode("production");
        properties.setPublicBaseUrl("https://ADMIN.example.com:443/");
        properties.setOrigins(List.of());
        properties.setSecure(true);
        properties.setCookiePath("/prod-api/auth/browser-session");
        return properties;
    }
}
