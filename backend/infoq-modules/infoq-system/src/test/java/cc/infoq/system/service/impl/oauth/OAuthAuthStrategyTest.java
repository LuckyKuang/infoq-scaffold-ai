package cc.infoq.system.service.impl.oauth;

import cc.infoq.common.domain.dto.UserOnlineDTO;
import cc.infoq.common.domain.model.LoginUser;
import cc.infoq.common.oauth.domain.OAuthLoginTicketPayload;
import cc.infoq.common.oauth.service.OAuthLoginTicketService;
import cc.infoq.common.security.auth.SecurityIssuedToken;
import cc.infoq.common.security.auth.SecurityTokenIssueRequest;
import cc.infoq.common.security.auth.SecurityTokenService;
import cc.infoq.common.utils.SpringUtils;
import cc.infoq.system.domain.vo.LoginVo;
import cc.infoq.system.domain.vo.SysClientVo;
import cc.infoq.system.domain.vo.SysUserVo;
import cc.infoq.system.listener.UserActionListener;
import cc.infoq.system.mapper.SysUserMapper;
import cc.infoq.system.service.AuthStrategy;
import cc.infoq.system.service.SysLoginService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.support.GenericApplicationContext;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@Tag("dev")
class OAuthAuthStrategyTest {

    private GenericApplicationContext context;

    @Mock
    private OAuthLoginTicketService ticketService;
    @Mock
    private SysUserMapper userMapper;
    @Mock
    private SysLoginService loginService;
    @Mock
    private SecurityTokenService tokenService;
    @Mock
    private UserActionListener userActionListener;

    @AfterEach
    void tearDown() {
        if (context != null) {
            context.close();
        }
    }

    @Test
    @DisplayName("loginForResult: should consume ticket and issue token")
    void loginForResultShouldConsumeTicketAndIssueToken() {
        initSpringContext();
        OAuthAuthStrategy strategy = new OAuthAuthStrategy(ticketService, userMapper, loginService, tokenService, userActionListener);
        OAuthLoginTicketPayload payload = ticketPayload();
        SysClientVo client = client();
        SysUserVo user = user();
        LoginUser loginUser = loginUser();
        when(ticketService.consumeTicket("ticket-1", "")).thenReturn(payload);
        when(userMapper.selectVoOne(any())).thenReturn(user);
        when(loginService.buildLoginUser(user)).thenReturn(loginUser);
        when(userActionListener.buildOnlineUser(eq(loginUser), eq("pc"), eq("web"))).thenReturn(new UserOnlineDTO());
        when(tokenService.issue(any(SecurityTokenIssueRequest.class)))
            .thenReturn(new SecurityIssuedToken("token-1", 7200L, "digest-1", "jwt-1"));

        AuthStrategy.LoginResult result = strategy.loginForResult(oauthBody("ticket-1"), client);

        LoginVo loginVo = result.loginVo();
        assertEquals("token-1", loginVo.getAccessToken());
        assertEquals(100L, result.userId());
        assertEquals("client-key", loginUser.getClientKey());
        assertEquals("web", loginUser.getDeviceType());
        ArgumentCaptor<SecurityTokenIssueRequest> requestCaptor = ArgumentCaptor.forClass(SecurityTokenIssueRequest.class);
        verify(tokenService).issue(requestCaptor.capture());
        assertSame(loginUser, requestCaptor.getValue().loginUser());
        verify(userActionListener).recordLoginSuccess(loginUser);
    }

    @Test
    @DisplayName("loginForResult: should revoke issued token when synchronous success recording fails")
    void loginForResultShouldRevokeIssuedTokenWhenSuccessRecordingFails() {
        initSpringContext();
        OAuthAuthStrategy strategy = new OAuthAuthStrategy(ticketService, userMapper, loginService, tokenService, userActionListener);
        LoginUser loginUser = loginUser();
        SecurityIssuedToken issuedToken = new SecurityIssuedToken("token-1", 7200L, "digest-1", "jwt-1");
        when(ticketService.consumeTicket("ticket-1", "")).thenReturn(ticketPayload());
        when(userMapper.selectVoOne(any())).thenReturn(user());
        when(loginService.buildLoginUser(any(SysUserVo.class))).thenReturn(loginUser);
        when(userActionListener.buildOnlineUser(eq(loginUser), eq("pc"), eq("web"))).thenReturn(new UserOnlineDTO());
        when(tokenService.issue(any(SecurityTokenIssueRequest.class))).thenReturn(issuedToken);
        org.mockito.Mockito.doThrow(new IllegalStateException("sync-log-failed"))
            .when(userActionListener).recordLoginSuccess(loginUser);

        assertThrows(IllegalStateException.class, () -> strategy.loginForResult(oauthBody("ticket-1"), client()));

        verify(tokenService).revoke(issuedToken.accessToken());
    }

    private void initSpringContext() {
        context = new GenericApplicationContext();
        context.registerBean(ObjectMapper.class, () -> new ObjectMapper());
        context.registerBean(Validator.class, () -> Validation.buildDefaultValidatorFactory().getValidator());
        context.refresh();
        new SpringUtils().setApplicationContext(context);
    }

    private OAuthLoginTicketPayload ticketPayload() {
        OAuthLoginTicketPayload payload = new OAuthLoginTicketPayload();
        payload.setUserId(100L);
        payload.setClientId("pc");
        payload.setBrowserBinding("");
        return payload;
    }

    private SysClientVo client() {
        SysClientVo client = new SysClientVo();
        client.setClientId("pc");
        client.setClientKey("client-key");
        client.setDeviceType("web");
        client.setTimeout(7200L);
        client.setActiveTimeout(1800L);
        return client;
    }

    private SysUserVo user() {
        SysUserVo user = new SysUserVo();
        user.setUserId(100L);
        user.setUserName("oauth_user");
        user.setStatus("0");
        return user;
    }

    private LoginUser loginUser() {
        LoginUser loginUser = new LoginUser();
        loginUser.setUserId(100L);
        loginUser.setUsername("oauth_user");
        return loginUser;
    }

    private String oauthBody(String loginTicket) {
        return "{\"clientId\":\"pc\",\"grantType\":\"oauth\",\"loginTicket\":\"" + loginTicket + "\"}";
    }
}
