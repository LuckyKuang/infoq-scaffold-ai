package cc.infoq.system.service.impl.oauth;

import cc.infoq.common.constant.Constants;
import cc.infoq.common.constant.SystemConstants;
import cc.infoq.common.exception.ServiceException;
import cc.infoq.common.json.utils.JsonUtils;
import cc.infoq.common.oauth.domain.OAuthIdentityProfile;
import cc.infoq.common.utils.DateUtils;
import cc.infoq.common.utils.MessageUtils;
import cc.infoq.common.utils.StringUtils;
import cc.infoq.system.domain.bo.SysOauthIdentityUnbindBo;
import cc.infoq.system.domain.entity.SysOauthIdentity;
import cc.infoq.system.domain.entity.SysOauthProvider;
import cc.infoq.system.domain.entity.SysUser;
import cc.infoq.system.domain.vo.ProfileOauthIdentityVo;
import cc.infoq.system.domain.vo.SysOauthIdentityVo;
import cc.infoq.system.domain.vo.SysOauthProviderVo;
import cc.infoq.system.domain.vo.SysUserVo;
import cc.infoq.system.mapper.SysOauthIdentityMapper;
import cc.infoq.system.mapper.SysOauthProviderMapper;
import cc.infoq.system.mapper.SysUserMapper;
import cc.infoq.system.service.SysConfigService;
import cc.infoq.system.service.SysLoginService;
import cc.infoq.system.service.SysOauthAutoRegistrationService;
import cc.infoq.system.service.SysOauthIdentityService;
import cn.hutool.core.collection.CollUtil;
import cn.hutool.crypto.SecureUtil;
import cn.hutool.crypto.digest.BCrypt;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.redisson.api.RLock;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * OAuth 身份关系服务实现。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SysOauthIdentityServiceImpl implements SysOauthIdentityService {

    private static final String BIND_LOCK_PREFIX = "oauth:bind:";

    private final SysOauthIdentityMapper identityMapper;
    private final SysOauthProviderMapper providerMapper;
    private final SysUserMapper userMapper;
    private final SysConfigService configService;
    private final SysLoginService loginService;
    private final SysOauthAutoRegistrationService autoRegistrationService;

    @Override
    public List<ProfileOauthIdentityVo> listByCurrentUser(Long userId) {
        List<SysOauthIdentityVo> identities = identityMapper.selectVoList(new LambdaQueryWrapper<SysOauthIdentity>()
            .eq(SysOauthIdentity::getUserId, userId)
            .orderByDesc(SysOauthIdentity::getLastLoginTime)
            .orderByDesc(SysOauthIdentity::getIdentityId));
        if (CollUtil.isEmpty(identities)) {
            return List.of();
        }
        boolean passwordConfirmationRequired = identities.stream()
            .filter(identity -> SystemConstants.NORMAL.equals(identity.getStatus()))
            .count() <= 1;
        Map<String, String> providerNames = providerMapper.selectList(new LambdaQueryWrapper<SysOauthProvider>()
                .in(SysOauthProvider::getProviderCode, identities.stream().map(SysOauthIdentityVo::getProviderCode).distinct().toList()))
            .stream().collect(Collectors.toMap(SysOauthProvider::getProviderCode, SysOauthProvider::getProviderName, (left, right) -> left));
        return identities.stream().map(identity -> {
            ProfileOauthIdentityVo result = new ProfileOauthIdentityVo();
            result.setIdentityId(identity.getIdentityId());
            result.setProviderCode(identity.getProviderCode());
            result.setProviderName(providerNames.getOrDefault(identity.getProviderCode(), identity.getProviderCode()));
            result.setStatus(identity.getStatus());
            result.setPasswordConfirmationRequired(passwordConfirmationRequired);
            result.setLastLoginTime(identity.getLastLoginTime());
            result.setCreateTime(identity.getCreateTime());
            return result;
        }).toList();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void bindIdentity(Long userId, SysOauthProviderVo provider, OAuthIdentityProfile profile) {
        RLock lock = cc.infoq.common.redis.utils.RedisUtils.getClient().getLock(buildBindLockKey(profile));
        boolean locked = false;
        try {
            locked = lock.tryLock(3, 30, TimeUnit.SECONDS);
            if (!locked) {
                throw new ServiceException(MessageUtils.message("auth.oauth.binding.busy"));
            }
            SysOauthIdentityVo existing = findIdentity(profile);
            if (existing != null) {
                if (existing.getUserId().equals(userId)) {
                    return;
                }
                throw new ServiceException(MessageUtils.message("auth.oauth.identity.bound"));
            }
            if (!SystemConstants.NORMAL.equals(provider.getEnabled()) || !SystemConstants.NORMAL.equals(provider.getAllowBind())) {
                throw new ServiceException(MessageUtils.message("auth.oauth.provider.bind.disabled"));
            }
            insertIdentity(userId, profile);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ServiceException(MessageUtils.message("auth.oauth.binding.busy"));
        } finally {
            if (locked && lock.isHeldByCurrentThread()) {
                lock.unlock();
            }
        }
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void unbindIdentity(Long userId, Long identityId, SysOauthIdentityUnbindBo bo) {
        SysOauthIdentity identity = identityMapper.selectById(identityId);
        if (identity == null || !userId.equals(identity.getUserId())) {
            throw new ServiceException(MessageUtils.message("auth.oauth.identity.not.found"));
        }
        long activeIdentityCount = identityMapper.selectCount(new LambdaQueryWrapper<SysOauthIdentity>()
            .eq(SysOauthIdentity::getUserId, userId)
            .eq(SysOauthIdentity::getStatus, SystemConstants.NORMAL));
        if (activeIdentityCount <= 1) {
            if (bo == null || StringUtils.isBlank(bo.getCurrentPassword())) {
                throw new ServiceException(MessageUtils.message("auth.oauth.identity.last.password.required"));
            }
            SysUserVo user = userMapper.selectVoOne(new LambdaQueryWrapper<SysUser>().eq(SysUser::getUserId, userId));
            if (user == null || StringUtils.isBlank(user.getPassword()) || !BCrypt.checkpw(bo.getCurrentPassword(), user.getPassword())) {
                throw new ServiceException(MessageUtils.message("auth.oauth.identity.last.password.invalid"));
            }
        }
        if (identityMapper.deleteById(identityId) != 1) {
            throw new ServiceException(MessageUtils.message("auth.oauth.identity.not.found"));
        }
        log.info("OAuth identity unbound, userId:{}, provider:{}, subjectHash:{}",
            userId, identity.getProviderCode(), shortHash(identity.getProviderSubject()));
    }

    @Override
    public Long resolveLoginUser(SysOauthProviderVo provider, OAuthIdentityProfile profile,
                                 boolean autoRegisterEnabled, boolean requireInviteWhenInviteRegisterEnabled) {
        SysOauthIdentityVo existing = findIdentity(profile);
        if (existing != null) {
            if (!SystemConstants.NORMAL.equals(existing.getStatus())) {
                recordOAuthFailure(profile, "auth.oauth.identity.disabled");
                throw new ServiceException(MessageUtils.message("auth.oauth.identity.disabled"));
            }
            updateLastLogin(existing.getIdentityId());
            return existing.getUserId();
        }
        if (!SystemConstants.NORMAL.equals(provider.getAllowAutoRegister()) || !autoRegisterEnabled) {
            recordOAuthFailure(profile, "auth.oauth.auto.register.disabled");
            throw new ServiceException(MessageUtils.message("auth.oauth.auto.register.disabled"));
        }
        if (!configService.selectRegisterEnabled()) {
            recordOAuthFailure(profile, "auth.oauth.register.disabled");
            throw new ServiceException(MessageUtils.message("auth.oauth.register.disabled"));
        }
        if (configService.selectInviteRegisterEnabled() && requireInviteWhenInviteRegisterEnabled) {
            recordOAuthFailure(profile, "auth.oauth.invite.required");
            throw new ServiceException(MessageUtils.message("auth.oauth.invite.required"));
        }
        return autoRegistrationService.autoRegisterAndBind(profile);
    }

    private SysOauthIdentityVo findIdentity(OAuthIdentityProfile profile) {
        return identityMapper.selectVoOne(new LambdaQueryWrapper<SysOauthIdentity>()
            .eq(SysOauthIdentity::getProviderCode, profile.getProviderCode())
            .eq(SysOauthIdentity::getProviderKey, profile.getProviderKey())
            .eq(SysOauthIdentity::getProviderSubject, profile.getSubject()));
    }

    private void insertIdentity(Long userId, OAuthIdentityProfile profile) {
        SysOauthIdentity identity = new SysOauthIdentity();
        identity.setUserId(userId);
        identity.setProviderCode(profile.getProviderCode());
        identity.setProviderKey(profile.getProviderKey());
        identity.setProviderSubject(profile.getSubject());
        identity.setUnionId(profile.getUnionId());
        identity.setOpenId(profile.getOpenId());
        identity.setProviderUsername(profile.getUsername());
        identity.setProviderNickname(profile.getNickname());
        identity.setProviderEmail(profile.getEmail());
        identity.setProviderAvatar(profile.getAvatar());
        identity.setEmailVerified(Boolean.TRUE.equals(profile.getEmailVerified()) ? SystemConstants.YES : SystemConstants.NO);
        identity.setMetadataJson(JsonUtils.toJsonString(profile.getRawAttributes()));
        identity.setStatus(SystemConstants.NORMAL);
        identity.setLastLoginTime(DateUtils.getNowDate());
        identity.setDelFlag(SystemConstants.NORMAL);
        try {
            identityMapper.insert(identity);
        } catch (DuplicateKeyException e) {
            throw new ServiceException(MessageUtils.message("auth.oauth.identity.bound"));
        }
        log.info("OAuth identity bound, userId:{}, provider:{}, subjectHash:{}",
            userId, profile.getProviderCode(), shortHash(profile.getSubject()));
    }

    private void updateLastLogin(Long identityId) {
        identityMapper.update(null, new LambdaUpdateWrapper<SysOauthIdentity>()
            .set(SysOauthIdentity::getLastLoginTime, new Date())
            .eq(SysOauthIdentity::getIdentityId, identityId));
    }

    private void recordOAuthFailure(OAuthIdentityProfile profile, String messageKey) {
        loginService.recordLoginInfo("oauth:" + profile.getProviderCode(), Constants.LOGIN_FAIL, MessageUtils.message(messageKey));
        log.info("OAuth login rejected, provider:{}, subjectHash:{}, reason:{}",
            profile.getProviderCode(), shortHash(profile.getSubject()), messageKey);
    }

    private String buildBindLockKey(OAuthIdentityProfile profile) {
        return BIND_LOCK_PREFIX + profile.getProviderCode() + ":" + profile.getProviderKey() + ":" + shortHash(profile.getSubject());
    }

    private String shortHash(String value) {
        return SecureUtil.sha256(StringUtils.blankToDefault(value, StringUtils.EMPTY)).substring(0, 16);
    }
}
