package cc.infoq.common.oauth.config.properties;

import cc.infoq.common.exception.ServiceException;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.util.Map;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.boot.context.properties.bind.Bindable;
import org.springframework.core.env.MapPropertySource;
import org.springframework.core.env.StandardEnvironment;

import static org.junit.jupiter.api.Assertions.*;

@Tag("dev")
class OAuthCallbackMappingTest {
    @Test void bindingPreservesDeploymentPrefixKeysUsingBracketNotation() {
        StandardEnvironment environment = new StandardEnvironment();
        environment.getPropertySources().addFirst(new MapPropertySource("map", Map.of(
            "oauth.frontend-callback-paths.[/react/]", "/react/oauth/callback",
            "oauth.frontend-callback-paths.[/vue/]", "/vue/oauth/callback")));
        OAuthProperties properties = Binder.get(environment).bind("oauth", Bindable.of(OAuthProperties.class)).get();
        assertEquals("/react/oauth/callback", properties.resolveFrontendCallbackPath("/react/index"));
        assertEquals("/vue/oauth/callback", properties.resolveFrontendCallbackPath("/vue/index"));
    }
    @Test void controlledMapUsesLongestSegmentPrefixAndRejectsUnknownFrontend() {
        OAuthProperties properties = new OAuthProperties();
        properties.setFrontendCallbackPaths(Map.of("/react/", "/react/oauth/callback", "/vue/", "/vue/oauth/callback",
            "/react/admin/", "/react/admin/oauth/callback"));
        assertEquals("/react/oauth/callback", properties.resolveFrontendCallbackPath("/react/index?q=1"));
        assertEquals("/vue/oauth/callback", properties.resolveFrontendCallbackPath("/vue/user/profile"));
        assertEquals("/react/admin/oauth/callback", properties.resolveFrontendCallbackPath("/react/admin/index"));
        assertThrows(ServiceException.class, () -> properties.resolveFrontendCallbackPath("/react-evil/index"));
        assertThrows(ServiceException.class, () -> properties.resolveFrontendCallbackPath(null));
        assertThrows(ServiceException.class, () -> properties.resolveFrontendCallbackPath("/index"));
    }
    @Test void explicitRootAndLegacySingleFrontendWorkWithoutGuessing() {
        OAuthProperties properties = new OAuthProperties();
        properties.setFrontendCallbackPath("/single/oauth/callback");
        assertEquals("/single/oauth/callback", properties.resolveFrontendCallbackPath(null));
        properties.setFrontendCallbackPaths(Map.of("/", "/oauth/callback"));
        assertEquals("/oauth/callback", properties.resolveFrontendCallbackPath(null));
    }
    @Test void configuredTargetsMustRemainWithinTheirControlledBase() {
        OAuthProperties properties = new OAuthProperties();
        properties.setFrontendCallbackPaths(Map.of("/react/", "/vue/oauth/callback"));
        assertThrows(ServiceException.class, () -> properties.resolveFrontendCallbackPath("/react/index"));
    }
}
