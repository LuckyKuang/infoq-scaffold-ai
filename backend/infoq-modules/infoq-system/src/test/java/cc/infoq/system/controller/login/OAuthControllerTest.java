package cc.infoq.system.controller.login;

import cc.infoq.common.exception.ServiceException;
import cc.infoq.common.utils.SpringUtils;
import cc.infoq.system.service.SysClientService;
import cc.infoq.system.service.SysOauthLoginService;
import cc.infoq.system.service.SysOauthProviderService;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.support.GenericApplicationContext;
import org.springframework.context.support.StaticMessageSource;
import org.springframework.web.servlet.view.RedirectView;

import java.util.Map;
import java.util.concurrent.ScheduledExecutorService;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@Tag("dev")
class OAuthControllerTest {

    private GenericApplicationContext context;

    @Mock
    private SysOauthProviderService providerService;
    @Mock
    private SysOauthLoginService oauthLoginService;
    @Mock
    private SysClientService sysClientService;
    @Mock
    private ScheduledExecutorService scheduledExecutorService;

    private OAuthController controller;

    @BeforeEach
    void setUp() {
        StaticMessageSource messageSource = new StaticMessageSource();
        context = new GenericApplicationContext();
        context.registerBean("messageSource", StaticMessageSource.class, () -> messageSource);
        context.refresh();
        new SpringUtils().setApplicationContext(context);
        controller = new OAuthController(providerService, oauthLoginService, sysClientService, scheduledExecutorService);
    }

    @AfterEach
    void tearDown() {
        if (context != null) {
            context.close();
        }
    }

    @Test
    @DisplayName("callback: should propagate service exception message")
    void callbackShouldPropagateServiceExceptionMessage() {
        when(oauthLoginService.handleCallback(eq("github"), any(), eq("")))
            .thenThrow(new ServiceException("business failure"));
        when(oauthLoginService.buildErrorRedirect("business failure")).thenReturn("/oauth/callback?message=business");

        RedirectView view = controller.callback("github", Map.of("code", "code-1", "state", "state-1"), null);

        assertEquals("/oauth/callback?message=business", view.getUrl());
        verify(oauthLoginService).buildErrorRedirect("business failure");
    }

    @Test
    @DisplayName("callback: should not leak unexpected exception message")
    void callbackShouldNotLeakUnexpectedExceptionMessage() {
        when(oauthLoginService.handleCallback(eq("github"), any(), eq("")))
            .thenThrow(new IllegalStateException("jdbc:password=secret"));
        when(oauthLoginService.buildErrorRedirect(anyString())).thenReturn("/oauth/callback?message=generic");

        RedirectView view = controller.callback("github", Map.of("code", "code-1", "state", "state-1"), null);

        assertEquals("/oauth/callback?message=generic", view.getUrl());
        ArgumentCaptor<String> messageCaptor = ArgumentCaptor.forClass(String.class);
        verify(oauthLoginService).buildErrorRedirect(messageCaptor.capture());
        assertFalse(messageCaptor.getValue().contains("jdbc:password=secret"),
            "Unexpected exception message must not leak into the error redirect");
    }
}
