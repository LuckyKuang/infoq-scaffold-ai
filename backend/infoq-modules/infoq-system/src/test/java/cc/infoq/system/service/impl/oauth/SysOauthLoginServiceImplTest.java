package cc.infoq.system.service.impl.oauth;

import cc.infoq.common.oauth.config.properties.OAuthProperties;
import cc.infoq.common.oauth.domain.OAuthCallbackRequest;
import cc.infoq.common.oauth.domain.OAuthCallbackResult;
import cc.infoq.common.oauth.domain.OAuthIdentityProfile;
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

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@Tag("dev")
class SysOauthLoginServiceImplTest {

    @Mock
    private OAuthFlowService oAuthFlowService;
    @Mock
    private OAuthLoginTicketService ticketService;
    @Mock
    private SysOauthProviderService providerService;
    @Mock
    private SysOauthIdentityService identityService;

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
