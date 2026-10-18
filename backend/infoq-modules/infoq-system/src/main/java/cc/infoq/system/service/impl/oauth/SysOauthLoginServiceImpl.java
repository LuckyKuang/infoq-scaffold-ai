package cc.infoq.system.service.impl.oauth;

import cc.infoq.common.exception.ServiceException;
import cc.infoq.common.oauth.domain.*;
import cc.infoq.common.oauth.service.OAuthFlowService;
import cc.infoq.common.oauth.service.OAuthLoginTicketService;
import cc.infoq.common.oauth.support.OAuthRedirectValidator;
import cc.infoq.common.utils.MessageUtils;
import cc.infoq.common.utils.StringUtils;
import cc.infoq.system.domain.vo.SysOauthProviderVo;
import cc.infoq.system.service.SysOauthIdentityService;
import cc.infoq.system.service.SysOauthLoginService;
import cc.infoq.system.service.SysOauthProviderService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;


@Slf4j
@Service
@RequiredArgsConstructor
public class SysOauthLoginServiceImpl implements SysOauthLoginService {

    private final OAuthFlowService oAuthFlowService;
    private final OAuthLoginTicketService ticketService;
    private final SysOauthProviderService providerService;
    private final SysOauthIdentityService identityService;

    @Override
    public OAuthAuthorizationResult createAuthorization(String providerCode, String clientId, String redirect, String browserBinding) {
        providerService.requireLoginProvider(providerCode);
        return oAuthFlowService.createAuthorization(providerCode, clientId, redirect, browserBinding);
    }

    @Override
    public OAuthAuthorizationResult createBindAuthorization(Long userId, String providerCode, String redirect, String browserBinding) {
        redirect = URI.create(OAuthRedirectValidator.requireSafeRelativeRedirect(redirect).replace(" ", "%20")).toASCIIString();
        oAuthFlowService.getProperties().resolveFrontendCallbackPath(redirect);
        providerService.requireBindProvider(providerCode);
        OAuthLoginTicketPayload payload = new OAuthLoginTicketPayload();
        payload.setUserId(userId);
        payload.setProviderCode(providerCode);
        payload.setRedirect(redirect);
        payload.setBrowserBinding(browserBinding);
        String ticket = ticketService.createTicket(payload, "bind.");
        return oAuthFlowService.createAuthorization(providerCode, ticket, redirect, browserBinding);
    }

    @Override
    public String handleCallback(String providerCode, OAuthCallbackRequest callbackRequest, String browserBinding) {
        OAuthCallbackResult callbackResult = oAuthFlowService.handleCallback(providerCode, callbackRequest, browserBinding);
        if (callbackResult.getClientId().startsWith("bind.")) {
            return handleBindCallback(providerCode, callbackResult, browserBinding);
        }
        SysOauthProviderVo provider = providerService.requireLoginProvider(providerCode);
        Long userId = resolveUserId(provider, callbackResult.getProfile());
        OAuthLoginTicketPayload payload = new OAuthLoginTicketPayload();
        payload.setUserId(userId);
        payload.setClientId(callbackResult.getClientId());
        payload.setProviderCode(callbackResult.getProfile().getProviderCode());
        payload.setProviderKey(callbackResult.getProfile().getProviderKey());
        payload.setProviderSubject(callbackResult.getProfile().getSubject());
        payload.setRedirect(callbackResult.getRedirect());
        payload.setBrowserBinding(callbackResult.getBrowserBinding());
        String ticket = ticketService.createTicket(payload);
        return buildSuccessRedirect(ticket, callbackResult.getRedirect());
    }

    @Override
    public String buildErrorRedirect(String message) {
        if (!oAuthFlowService.getProperties().getFrontendCallbackPaths().isEmpty()) {
            throw new ServiceException(MessageUtils.message("auth.oauth.callback.failed"));
        }
        String callbackPath = OAuthRedirectValidator.requireSafeRelativeRedirect(oAuthFlowService.getProperties().getFrontendCallbackPath());
        return UriComponentsBuilder.fromPath(callbackPath)
            .queryParam("error", "oauth_failed")
            .queryParam("message", MessageUtils.message("auth.oauth.callback.failed"))
            .build()
            .encode()
            .toUriString();
    }

    private String buildSuccessRedirect(String ticket, String redirect) {
        String callbackPath = oAuthFlowService.getProperties().resolveFrontendCallbackPath(redirect);
        return UriComponentsBuilder.fromPath(callbackPath)
            .queryParam("loginTicket", ticket)
            .queryParam("redirect", OAuthRedirectValidator.requireSafeRelativeRedirect(redirect))
            .build()
            .encode()
            .toUriString();
    }

    private Long resolveUserId(SysOauthProviderVo provider, OAuthIdentityProfile profile) {
        return identityService.resolveLoginUser(provider, profile,
            oAuthFlowService.getProperties().isAutoRegisterEnabled(),
            oAuthFlowService.getProperties().isRequireInviteWhenInviteRegisterEnabled());
    }

    private String handleBindCallback(String providerCode, OAuthCallbackResult callbackResult, String browserBinding) {
        String redirect = URI.create(OAuthRedirectValidator.requireSafeRelativeRedirect(callbackResult.getRedirect()).replace(" ", "%20")).toASCIIString();
        OAuthLoginTicketPayload ticket = ticketService.consumeTicket(callbackResult.getClientId(), browserBinding);
        if (!StringUtils.equals(providerCode, ticket.getProviderCode())) {
            throw new ServiceException(MessageUtils.message("auth.oauth.ticket.invalid"));
        }
        identityService.bindIdentity(ticket.getUserId(), providerService.requireBindProvider(providerCode), callbackResult.getProfile());
        return UriComponentsBuilder.fromUriString(redirect)
            .queryParam("bind", "success")
            .queryParam("provider", providerCode)
            .build(true)
            .toUriString();
    }
}
