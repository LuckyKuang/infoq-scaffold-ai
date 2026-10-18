package cc.infoq.common.oauth.service;

import cc.infoq.common.exception.ServiceException;
import cc.infoq.common.oauth.adapter.OAuthProviderAdapter;
import cc.infoq.common.oauth.adapter.OAuthProviderRegistry;
import cc.infoq.common.oauth.config.properties.OAuthProperties;
import cc.infoq.common.oauth.domain.OAuthPendingSession;
import cc.infoq.common.utils.SpringUtils;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.context.support.GenericApplicationContext;
import org.springframework.context.support.StaticMessageSource;

import java.net.URI;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@Tag("dev")
class OAuthFlowServiceTest {
    @BeforeAll
    static void messageContext() {
        GenericApplicationContext context = new GenericApplicationContext();
        context.registerBean("messageSource", StaticMessageSource.class, StaticMessageSource::new);
        context.refresh();
        new SpringUtils().setApplicationContext(context);
    }

    @Test
    void safeSubpathIsStoredAndInvalidRedirectHasNoAuthorizationSideEffects() {
        OAuthProperties properties = new OAuthProperties();
        properties.setEnabled(true);
        OAuthProperties.Provider provider = new OAuthProperties.Provider();
        properties.getProviders().put("github", provider);
        OAuthProviderAdapter adapter = mock(OAuthProviderAdapter.class);
        when(adapter.providerCode()).thenReturn("github");
        when(adapter.isConfigured(provider)).thenReturn(true);
        when(adapter.buildAuthorizationUri(eq(provider), any())).thenReturn(URI.create("https://provider.example/authorize"));
        OAuthRedisStateStore state = mock(OAuthRedisStateStore.class);
        OAuthFlowService service = new OAuthFlowService(properties, new OAuthProviderRegistry(List.of(adapter)), state);
        assertEquals("https://provider.example/authorize",
            service.createAuthorization("github", "pc", "/react/user/profile?q=a%26b", "binding").getAuthorizationUri().toString());
        ArgumentCaptor<OAuthPendingSession> pending = ArgumentCaptor.forClass(OAuthPendingSession.class);
        verify(state).save(pending.capture());
        assertEquals("/react/user/profile?q=a%26b", pending.getValue().getRedirect());
        clearInvocations(state, adapter);
        assertThrows(ServiceException.class, () -> service.createAuthorization("github", "pc", "/%252fevil", "binding"));
        verifyNoInteractions(state);
        verify(adapter, never()).buildAuthorizationUri(any(), any());
    }
}
