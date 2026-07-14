package cc.infoq.system.service.impl;

import cc.infoq.common.constant.SystemConstants;
import cc.infoq.common.domain.dto.UserOnlineDTO;
import cc.infoq.common.domain.model.LoginUser;
import cc.infoq.common.domain.model.WechatMiniAppLoginBody;
import cc.infoq.common.exception.ServiceException;
import cc.infoq.common.json.utils.JsonUtils;
import cc.infoq.common.oauth.domain.OAuthIdentityProfile;
import cc.infoq.common.security.auth.SecurityIssuedToken;
import cc.infoq.common.security.auth.SecurityTokenService;
import cc.infoq.common.utils.MessageUtils;
import cc.infoq.common.utils.StringUtils;
import cc.infoq.common.utils.ValidatorUtils;
import cc.infoq.system.config.WechatMiniAppProperties;
import cc.infoq.system.domain.entity.SysUser;
import cc.infoq.system.domain.vo.LoginVo;
import cc.infoq.system.domain.vo.SysClientVo;
import cc.infoq.system.domain.vo.SysOauthProviderVo;
import cc.infoq.system.domain.vo.SysUserVo;
import cc.infoq.system.listener.UserActionListener;
import cc.infoq.system.mapper.SysUserMapper;
import cc.infoq.system.service.AuthStrategy;
import cc.infoq.system.service.SysLoginService;
import cc.infoq.system.service.SysOauthIdentityService;
import cc.infoq.system.service.SysOauthProviderService;
import cn.hutool.core.util.ObjectUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * 微信小程序 code 认证策略。
 */
@Slf4j
@Service("xcx" + AuthStrategy.BASE_NAME)
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "infoq.auth.wechat-miniapp", name = "enabled", havingValue = "true")
public class WechatMiniAppAuthStrategy implements AuthStrategy, InitializingBean {

    private static final String PROVIDER_CODE = "wechat_miniapp";

    private final WechatMiniAppProperties properties;
    private final RestClient.Builder restClientBuilder;
    private final SysOauthProviderService providerService;
    private final SysOauthIdentityService identityService;
    private final SysUserMapper userMapper;
    private final SysLoginService loginService;
    private final SecurityTokenService tokenService;
    private final UserActionListener userActionListener;

    @Override
    public AuthStrategy.LoginResult loginForResult(String body, SysClientVo client) {
        WechatMiniAppLoginBody loginBody = JsonUtils.parseObjectStrict(body, WechatMiniAppLoginBody.class);
        ValidatorUtils.validate(loginBody);
        if (!SystemConstants.GRANT_TYPE_WECHAT_MINIAPP.equals(loginBody.getGrantType())) {
            throw new ServiceException(MessageUtils.message("auth.grant.type.error"));
        }

        WechatSessionResponse response = requestSession(loginBody.getCode());
        if (response == null || StringUtils.isBlank(response.getOpenid()) || (response.getErrcode() != null && response.getErrcode() != 0)) {
            log.info("Wechat miniapp login rejected, errCode:{}", response == null ? null : response.getErrcode());
            throw new ServiceException(MessageUtils.message("auth.wechat.miniapp.code.invalid"));
        }
        OAuthIdentityProfile profile = new OAuthIdentityProfile();
        profile.setProviderCode(PROVIDER_CODE);
        profile.setProviderKey(properties.getAppId());
        profile.setSubject(response.getOpenid());
        profile.setOpenId(response.getOpenid());
        profile.setUnionId(response.getUnionid());
        SysOauthProviderVo provider = providerService.requireLoginProvider(PROVIDER_CODE);
        Long userId = identityService.resolveLoginUser(provider, profile,
            properties.isAutoRegisterEnabled(), properties.isRequireInviteWhenInviteRegisterEnabled());
        SysUserVo user = loadUserById(userId);
        LoginUser loginUser = loginService.buildLoginUser(user);
        loginUser.setClientKey(client.getClientKey());
        loginUser.setDeviceType(client.getDeviceType());
        UserOnlineDTO onlineUser = userActionListener.buildOnlineUser(loginUser, client.getClientId(), client.getDeviceType());
        SecurityIssuedToken issuedToken = tokenService.issue(AuthStrategy.createIssueRequest(loginUser, client, onlineUser));
        try {
            userActionListener.recordLoginSuccess(loginUser);
        } catch (RuntimeException e) {
            tokenService.revoke(issuedToken.accessToken());
            throw e;
        }
        LoginVo loginVo = AuthStrategy.createLoginVo(issuedToken, client);
        return new AuthStrategy.LoginResult(loginVo, loginUser.getUserId());
    }

    private WechatSessionResponse requestSession(String code) {
        String uri = UriComponentsBuilder.fromUriString(properties.getSessionEndpoint())
            .queryParam("appid", properties.getAppId())
            .queryParam("secret", properties.getSecret())
            .queryParam("js_code", code)
            .queryParam("grant_type", "authorization_code")
            .build(true)
            .toUriString();
        try {
            return restClientBuilder.build().get().uri(uri)
                .accept(MediaType.APPLICATION_JSON)
                .retrieve()
                .body(WechatSessionResponse.class);
        } catch (RuntimeException e) {
            log.warn("Wechat miniapp session request failed, type:{}", e.getClass().getSimpleName());
            throw new ServiceException(MessageUtils.message("auth.wechat.miniapp.unavailable"));
        }
    }

    private SysUserVo loadUserById(Long userId) {
        SysUserVo user = userMapper.selectVoOne(new LambdaQueryWrapper<SysUser>().eq(SysUser::getUserId, userId));
        if (ObjectUtil.isNull(user)) {
            throw new ServiceException(MessageUtils.message("user.not.exists", userId));
        }
        if (SystemConstants.DISABLE.equals(user.getStatus())) {
            throw new ServiceException(MessageUtils.message("user.blocked", user.getUserName()));
        }
        return user;
    }

    private void validateConfiguration() {
        if (StringUtils.isBlank(properties.getAppId()) || StringUtils.isBlank(properties.getSecret())
            || StringUtils.isBlank(properties.getSessionEndpoint())) {
            throw new ServiceException(MessageUtils.message("auth.wechat.miniapp.not.configured"));
        }
    }

    @Override
    public void afterPropertiesSet() {
        validateConfiguration();
    }

    @Data
    public static class WechatSessionResponse {

        private String openid;

        private String unionid;

        private Integer errcode;

        private String errmsg;
    }
}
