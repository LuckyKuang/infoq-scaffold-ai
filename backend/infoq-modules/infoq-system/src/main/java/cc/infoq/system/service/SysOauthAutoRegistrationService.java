package cc.infoq.system.service;

import cc.infoq.common.oauth.domain.OAuthIdentityProfile;

public interface SysOauthAutoRegistrationService {

    Long autoRegisterAndBind(OAuthIdentityProfile profile);
}
