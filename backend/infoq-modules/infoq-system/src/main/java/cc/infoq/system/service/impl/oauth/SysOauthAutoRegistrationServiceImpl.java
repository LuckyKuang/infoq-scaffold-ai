package cc.infoq.system.service.impl.oauth;

import cc.infoq.common.constant.SystemConstants;
import cc.infoq.common.enums.UserType;
import cc.infoq.common.exception.ServiceException;
import cc.infoq.common.exception.user.UserException;
import cc.infoq.common.json.utils.JsonUtils;
import cc.infoq.common.mybatis.helper.DataPermissionHelper;
import cc.infoq.common.oauth.domain.OAuthIdentityProfile;
import cc.infoq.common.utils.DateUtils;
import cc.infoq.common.utils.MessageUtils;
import cc.infoq.common.utils.StringUtils;
import cc.infoq.system.domain.bo.SysUserBo;
import cc.infoq.system.domain.entity.SysDept;
import cc.infoq.system.domain.entity.SysOauthIdentity;
import cc.infoq.system.domain.entity.SysPost;
import cc.infoq.system.domain.entity.SysRole;
import cc.infoq.system.domain.vo.SysOauthIdentityVo;
import cc.infoq.system.mapper.SysDeptMapper;
import cc.infoq.system.mapper.SysOauthIdentityMapper;
import cc.infoq.system.mapper.SysPostMapper;
import cc.infoq.system.mapper.SysRoleMapper;
import cc.infoq.system.service.SysOauthAutoRegistrationService;
import cc.infoq.system.service.SysUserService;
import cn.hutool.crypto.SecureUtil;
import cn.hutool.crypto.digest.BCrypt;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.redisson.api.RLock;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class SysOauthAutoRegistrationServiceImpl implements SysOauthAutoRegistrationService {

    private static final String AUTO_REGISTER_EMAIL_DOMAIN = "oauth-connect.invalid";
    private static final String BIND_LOCK_PREFIX = "oauth:bind:";

    private final SysOauthIdentityMapper identityMapper;
    private final SysUserService userService;
    private final SysRoleMapper roleMapper;
    private final SysPostMapper postMapper;
    private final SysDeptMapper deptMapper;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Long autoRegisterAndBind(OAuthIdentityProfile profile) {
        RLock lock = cc.infoq.common.redis.utils.RedisUtils.getClient().getLock(buildBindLockKey(profile));
        boolean locked = false;
        try {
            locked = lock.tryLock(3, 30, TimeUnit.SECONDS);
            if (!locked) {
                throw new ServiceException(MessageUtils.message("auth.oauth.binding.busy"));
            }
            SysOauthIdentityVo existing = findIdentity(profile);
            if (existing != null) {
                return existing.getUserId();
            }
            SysUserBo user = buildOAuthRegisterUser(profile);
            if (!userService.checkUserNameUnique(user)) {
                throw new UserException("user.register.save.error", user.getUserName());
            }
            if (StringUtils.isNotBlank(user.getEmail()) && !userService.checkEmailUnique(user)) {
                throw new UserException("user.email.already.exists", user.getEmail());
            }
            boolean saved = DataPermissionHelper.ignore(() -> userService.registerUser(user));
            if (!saved) {
                throw new UserException("user.register.error");
            }
            insertIdentity(user.getUserId(), profile);
            log.info("OAuth auto register success, userId:{}, provider:{}, subjectHash:{}",
                user.getUserId(), profile.getProviderCode(), shortHash(profile.getSubject()));
            return user.getUserId();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ServiceException(MessageUtils.message("auth.oauth.binding.busy"));
        } finally {
            if (locked && lock.isHeldByCurrentThread()) {
                lock.unlock();
            }
        }
    }

    private SysUserBo buildOAuthRegisterUser(OAuthIdentityProfile profile) {
        SysUserBo user = new SysUserBo();
        String username = buildUsername(profile);
        user.setUserName(username);
        user.setNickName(StringUtils.blankToDefault(profile.getNickname(), username));
        user.setPassword(BCrypt.hashpw(SecureUtil.md5(profile.getProviderCode() + ":" + profile.getSubject() + ":" + System.nanoTime())));
        user.setEmail(resolveRegisterEmail(profile));
        user.setUserType(UserType.SYS_USER.getUserType());
        user.setDeptId(SystemConstants.REGISTER_DEFAULT_DEPT_ID);
        user.setCreateDept(SystemConstants.REGISTER_DEFAULT_DEPT_ID);
        user.setStatus(SystemConstants.NORMAL);
        user.setRoleIds(new Long[]{resolveDefaultRoleId()});
        user.setPostIds(new Long[]{resolveDefaultPostId()});
        return user;
    }

    private String buildUsername(OAuthIdentityProfile profile) {
        String digest = SecureUtil.md5(profile.getProviderCode() + ":" + profile.getSubject());
        return "oauth_" + digest.substring(0, 14);
    }

    private String resolveRegisterEmail(OAuthIdentityProfile profile) {
        if (StringUtils.isNotBlank(profile.getEmail())) {
            return profile.getEmail();
        }
        return profile.getProviderCode() + "-" + profile.getSubject() + "@" + AUTO_REGISTER_EMAIL_DOMAIN;
    }

    private Long resolveDefaultRoleId() {
        SysRole role = DataPermissionHelper.ignore(() -> roleMapper.selectOne(new LambdaQueryWrapper<SysRole>()
            .select(SysRole::getRoleId)
            .eq(SysRole::getRoleKey, SystemConstants.REGISTER_DEFAULT_ROLE_KEY)
            .last("limit 1")));
        if (role == null || role.getRoleId() == null) {
            throw new ServiceException(MessageUtils.message("auth.oauth.default.role.missing"));
        }
        return role.getRoleId();
    }

    private Long resolveDefaultPostId() {
        long deptCount = DataPermissionHelper.ignore(() -> deptMapper.selectCount(new LambdaQueryWrapper<SysDept>()
            .eq(SysDept::getDeptId, SystemConstants.REGISTER_DEFAULT_DEPT_ID)));
        if (deptCount < 1) {
            throw new ServiceException(MessageUtils.message("auth.oauth.default.dept.missing"));
        }
        SysPost post = DataPermissionHelper.ignore(() -> postMapper.selectOne(new LambdaQueryWrapper<SysPost>()
            .select(SysPost::getPostId)
            .eq(SysPost::getPostCode, SystemConstants.REGISTER_DEFAULT_POST_CODE)
            .last("limit 1")));
        if (post == null || post.getPostId() == null) {
            throw new ServiceException(MessageUtils.message("auth.oauth.default.post.missing"));
        }
        return post.getPostId();
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
            throw new ServiceException(MessageUtils.message("auth.oauth.binding.busy"));
        }
        log.info("OAuth identity bind success, userId:{}, provider:{}, subjectHash:{}",
            userId, profile.getProviderCode(), shortHash(profile.getSubject()));
    }

    private String buildBindLockKey(OAuthIdentityProfile profile) {
        return BIND_LOCK_PREFIX + profile.getProviderCode() + ":" + profile.getProviderKey() + ":" + shortHash(profile.getSubject());
    }

    private String shortHash(String value) {
        return SecureUtil.sha256(StringUtils.blankToDefault(value, StringUtils.EMPTY)).substring(0, 16);
    }
}
