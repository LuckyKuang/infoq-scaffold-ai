package cc.infoq.system.service;

import cc.infoq.common.oauth.domain.OAuthIdentityProfile;
import cc.infoq.system.domain.bo.SysOauthIdentityUnbindBo;
import cc.infoq.system.domain.vo.ProfileOauthIdentityVo;
import cc.infoq.system.domain.vo.SysOauthProviderVo;

import java.util.List;

/**
 * 当前用户 OAuth 身份关系服务。
 */
public interface SysOauthIdentityService {

    List<ProfileOauthIdentityVo> listByCurrentUser(Long userId);

    void bindIdentity(Long userId, SysOauthProviderVo provider, OAuthIdentityProfile profile);

    void unbindIdentity(Long userId, Long identityId, SysOauthIdentityUnbindBo bo);

    Long resolveLoginUser(SysOauthProviderVo provider, OAuthIdentityProfile profile,
                          boolean autoRegisterEnabled, boolean requireInviteWhenInviteRegisterEnabled);
}
