package cc.infoq.system.service;

import cc.infoq.system.domain.vo.OAuthProviderOptionVo;
import cc.infoq.system.domain.vo.SysOauthProviderVo;

import java.util.List;

public interface SysOauthProviderService {

    List<OAuthProviderOptionVo> listLoginProviders();

    SysOauthProviderVo requireLoginProvider(String providerCode);

    /**
     * 获取允许绑定的 OAuth Provider。
     */
    SysOauthProviderVo requireBindProvider(String providerCode);
}
