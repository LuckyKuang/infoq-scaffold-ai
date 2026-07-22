package cc.infoq.system.service.impl.oauth;

import cc.infoq.common.constant.SystemConstants;
import cc.infoq.common.exception.ServiceException;
import cc.infoq.common.oauth.service.OAuthFlowService;
import cc.infoq.common.utils.MessageUtils;
import cc.infoq.common.utils.StringUtils;
import cc.infoq.system.domain.entity.SysOauthProvider;
import cc.infoq.system.domain.vo.OAuthProviderOptionVo;
import cc.infoq.system.domain.vo.SysOauthProviderVo;
import cc.infoq.system.mapper.SysOauthProviderMapper;
import cc.infoq.system.service.SysOauthProviderService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class SysOauthProviderServiceImpl implements SysOauthProviderService {

    private final OAuthFlowService oAuthFlowService;
    private final SysOauthProviderMapper providerMapper;

    @Override
    public List<OAuthProviderOptionVo> listLoginProviders() {
        if (!oAuthFlowService.isEnabled()) {
            return List.of();
        }
        List<SysOauthProviderVo> providers = providerMapper.selectVoList(new LambdaQueryWrapper<SysOauthProvider>()
            .eq(SysOauthProvider::getEnabled, SystemConstants.NORMAL)
            .eq(SysOauthProvider::getAllowLogin, SystemConstants.NORMAL)
            .orderByAsc(SysOauthProvider::getSort)
            .orderByAsc(SysOauthProvider::getProviderId));
        return providers.stream()
            .filter(provider -> {
                try {
                    return oAuthFlowService.isProviderConfigured(provider.getProviderCode());
                } catch (ServiceException ignored) {
                    return false;
                }
            })
            .map(provider -> {
                OAuthProviderOptionVo vo = new OAuthProviderOptionVo();
                vo.setProviderCode(provider.getProviderCode());
                vo.setProviderName(provider.getProviderName());
                return vo;
            })
            .toList();
    }

    @Override
    public SysOauthProviderVo requireLoginProvider(String providerCode) {
        if (StringUtils.isBlank(providerCode)) {
            throw new ServiceException(MessageUtils.message("auth.oauth.provider.unsupported"));
        }
        SysOauthProviderVo provider = providerMapper.selectVoOne(new LambdaQueryWrapper<SysOauthProvider>()
            .eq(SysOauthProvider::getProviderCode, providerCode));
        if (provider == null
            || !SystemConstants.NORMAL.equals(provider.getEnabled())
            || !SystemConstants.NORMAL.equals(provider.getAllowLogin())) {
            throw new ServiceException(MessageUtils.message("auth.oauth.provider.disabled"));
        }
        if (!oAuthFlowService.isProviderConfigured(providerCode)) {
            throw new ServiceException(MessageUtils.message("auth.oauth.provider.not.configured"));
        }
        return provider;
    }

    @Override
    public SysOauthProviderVo requireBindProvider(String providerCode) {
        SysOauthProviderVo provider = providerMapper.selectVoOne(new LambdaQueryWrapper<SysOauthProvider>()
            .eq(SysOauthProvider::getProviderCode, providerCode));
        if (provider == null || !SystemConstants.NORMAL.equals(provider.getEnabled())
            || !SystemConstants.NORMAL.equals(provider.getAllowBind())) {
            throw new ServiceException(MessageUtils.message("auth.oauth.provider.bind.disabled"));
        }
        return provider;
    }
}
