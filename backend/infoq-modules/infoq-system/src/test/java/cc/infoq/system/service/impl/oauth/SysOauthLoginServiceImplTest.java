package cc.infoq.system.service.impl.oauth;

import cc.infoq.common.oauth.config.properties.OAuthProperties;
import cc.infoq.common.oauth.domain.OAuthCallbackRequest;
import cc.infoq.common.oauth.domain.OAuthCallbackResult;
import cc.infoq.common.oauth.domain.OAuthIdentityProfile;
import cc.infoq.common.oauth.domain.OAuthLoginTicketPayload;
import cc.infoq.common.oauth.service.OAuthFlowService;
import cc.infoq.common.oauth.service.OAuthLoginTicketService;
import cc.infoq.system.domain.vo.SysOauthProviderVo;
import cc.infoq.system.service.SysOauthIdentityService;
import cc.infoq.system.service.SysOauthProviderService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.annotation.Transactional;

import java.lang.reflect.Method;
import java.util.Map;
import cc.infoq.common.exception.ServiceException;
import cc.infoq.common.utils.SpringUtils;
import org.springframework.context.support.GenericApplicationContext;
import org.springframework.context.support.StaticMessageSource;
import org.junit.jupiter.api.BeforeAll;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@Tag("dev")
class SysOauthLoginServiceImplTest {
    @BeforeAll static void context() {
        GenericApplicationContext context = new GenericApplicationContext();
        context.registerBean("messageSource", StaticMessageSource.class, StaticMessageSource::new);
        context.refresh(); new SpringUtils().setApplicationContext(context);
    }

    @Mock
    private OAuthFlowService oAuthFlowService;
    @Mock
    private OAuthLoginTicketService ticketService;
    @Mock
    private SysOauthProviderService providerService;
    @Mock
    private SysOauthIdentityService identityService;

    @Test
    void bindCallbackPreservesQueryHashAndDeploymentPrefix() {
        OAuthCallbackResult callback = callbackResult(profile());
        callback.setClientId("bind.ticket-1");
        callback.setRedirect("/react/user/profile?q=a%26b&term=hello world&zh=中文#身份");
        when(oAuthFlowService.handleCallback(any(), any(), any())).thenReturn(callback);
        OAuthLoginTicketPayload ticket = new OAuthLoginTicketPayload();
        ticket.setProviderCode("github"); ticket.setUserId(100L);
        when(ticketService.consumeTicket("bind.ticket-1", "binding")).thenReturn(ticket);
        when(providerService.requireBindProvider("github")).thenReturn(provider());
        String target = buildService().handleCallback("github", callbackRequest(), "binding");
        assertEquals("/react/user/profile?q=a%26b&term=hello%20world&zh=%E4%B8%AD%E6%96%87&bind=success&provider=github#%E8%BA%AB%E4%BB%BD", target);
        verify(identityService).bindIdentity(eq(100L), any(), eq(callback.getProfile()));
    }

    @Test
    void invalidBindRedirectCreatesNoTicketAndUnknownErrorCannotGuessAnotherFrontend() {
        assertThrows(ServiceException.class, () -> buildService().createBindAuthorization(100L, "github", "/%2fevil", ""));
        verifyNoInteractions(ticketService, identityService, providerService, oAuthFlowService);
        OAuthProperties properties = oauthProperties();
        properties.setFrontendCallbackPaths(Map.of("/react/", "/react/oauth/callback", "/vue/", "/vue/oauth/callback"));
        when(oAuthFlowService.getProperties()).thenReturn(properties);
        ServiceException failure = assertThrows(ServiceException.class, () -> buildService().buildErrorRedirect("provider-secret"));
        assertFalse(failure.getMessage().contains("provider-secret"));
        verifyNoInteractions(ticketService);
    }

    @Test
    void successfulCallbackUsesTheControlledMatchingFrontend() {
        OAuthIdentityProfile profile = profile(); OAuthCallbackResult callback = callbackResult(profile);
        callback.setRedirect("/vue/user/profile?q=a%26b");
        OAuthProperties properties = oauthProperties();
        properties.setFrontendCallbackPaths(Map.of("/react/", "/react/oauth/callback", "/vue/", "/vue/oauth/callback"));
        when(oAuthFlowService.getProperties()).thenReturn(properties);
        when(oAuthFlowService.handleCallback(any(), any(), any())).thenReturn(callback);
        when(providerService.requireLoginProvider("github")).thenReturn(provider());
        when(identityService.resolveLoginUser(any(), any(), anyBoolean(), anyBoolean())).thenReturn(100L);
        when(ticketService.createTicket(any())).thenReturn("ticket-1");
        String result = buildService().handleCallback("github", callbackRequest(), "binding");
        assertTrue(result.startsWith("/vue/oauth/callback?"));
        assertTrue(result.contains("loginTicket=ticket-1"));
        assertFalse(result.startsWith("/react/"));
    }

    @Test
    @DisplayName("transaction boundary: callback should not wrap external profile fetch")
    void callbackShouldNotDeclareTransaction() throws NoSuchMethodException {
        Method callback = SysOauthLoginServiceImpl.class.getMethod(
            "handleCallback", String.class, OAuthCallbackRequest.class, String.class);

        assertFalse(callback.isAnnotationPresent(Transactional.class));
    }

    @Test
    @DisplayName("handleCallback: should delegate identity resolution to the unified identity service")
    void handleCallbackShouldDelegateIdentityResolution() {
        SysOauthLoginServiceImpl service = buildService();
        OAuthIdentityProfile profile = profile();
        OAuthCallbackRequest request = callbackRequest();
        when(providerService.requireLoginProvider("github")).thenReturn(provider());
        when(oAuthFlowService.handleCallback(eq("github"), any(OAuthCallbackRequest.class), eq(""))).thenReturn(callbackResult(profile));
        when(identityService.resolveLoginUser(any(), eq(profile), eq(true), eq(true))).thenReturn(100L);
        when(ticketService.createTicket(any())).thenReturn("ticket-1");
        when(oAuthFlowService.getProperties()).thenReturn(oauthProperties());

        service.handleCallback("github", request, "");

        verify(identityService).resolveLoginUser(any(), eq(profile), eq(true), eq(true));
    }

    @Test
    @DisplayName("handleCallback: should pass configured auto registration policy to the identity service")
    void handleCallbackShouldPassConfiguredAutoRegistrationPolicy() {
        SysOauthLoginServiceImpl service = buildService();
        OAuthIdentityProfile profile = profile();
        OAuthCallbackRequest request = callbackRequest();
        when(providerService.requireLoginProvider("github")).thenReturn(provider());
        when(oAuthFlowService.handleCallback(eq("github"), any(OAuthCallbackRequest.class), eq(""))).thenReturn(callbackResult(profile));
        OAuthProperties properties = oauthProperties();
        properties.setAutoRegisterEnabled(true);
        properties.setRequireInviteWhenInviteRegisterEnabled(false);
        when(oAuthFlowService.getProperties()).thenReturn(properties);
        when(identityService.resolveLoginUser(any(), eq(profile), eq(true), eq(false))).thenReturn(101L);
        when(ticketService.createTicket(any())).thenReturn("ticket-1");

        service.handleCallback("github", request, "");

        verify(identityService).resolveLoginUser(any(), eq(profile), eq(true), eq(false));
    }

    private SysOauthLoginServiceImpl buildService() {
        return new SysOauthLoginServiceImpl(
            oAuthFlowService,
            ticketService,
            providerService,
            identityService);
    }

    private SysOauthProviderVo provider() {
        SysOauthProviderVo provider = new SysOauthProviderVo();
        provider.setProviderCode("github");
        provider.setAllowAutoRegister("0");
        return provider;
    }

    private OAuthCallbackRequest callbackRequest() {
        OAuthCallbackRequest request = new OAuthCallbackRequest();
        request.setCode("code-1");
        request.setState("state-1");
        return request;
    }

    private OAuthCallbackResult callbackResult(OAuthIdentityProfile profile) {
        OAuthCallbackResult result = new OAuthCallbackResult();
        result.setClientId("pc");
        result.setRedirect("/");
        result.setBrowserBinding("");
        result.setProfile(profile);
        return result;
    }

    private OAuthIdentityProfile profile() {
        OAuthIdentityProfile profile = new OAuthIdentityProfile();
        profile.setProviderCode("github");
        profile.setProviderKey("github");
        profile.setSubject("123");
        return profile;
    }

    private OAuthProperties oauthProperties() {
        OAuthProperties properties = new OAuthProperties();
        properties.setFrontendCallbackPath("/oauth/callback");
        properties.setRequireInviteWhenInviteRegisterEnabled(true);
        return properties;
    }
}
