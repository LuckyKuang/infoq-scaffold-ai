package cc.infoq.system.service.impl;

import cc.infoq.common.constant.CacheConstants;
import cc.infoq.common.constant.Constants;
import cc.infoq.common.domain.dto.PostDTO;
import cc.infoq.common.domain.dto.RoleDTO;
import cc.infoq.common.domain.model.LoginUser;
import cc.infoq.common.enums.LoginType;
import cc.infoq.common.exception.user.UserException;
import cc.infoq.common.log.event.LoginInfoEvent;
import cc.infoq.common.mybatis.helper.DataPermissionHelper;
import cc.infoq.common.redis.utils.RedisUtils;
import cc.infoq.common.security.auth.CurrentUserService;
import cc.infoq.common.security.auth.SecurityTokenAuthentication;
import cc.infoq.common.security.auth.SecurityTokenService;
import cc.infoq.common.utils.*;
import cc.infoq.system.domain.entity.SysUser;
import cc.infoq.system.domain.vo.SysDeptVo;
import cc.infoq.system.domain.vo.SysPostVo;
import cc.infoq.system.domain.vo.SysRoleVo;
import cc.infoq.system.domain.vo.SysUserVo;
import cc.infoq.system.mapper.SysUserMapper;
import cc.infoq.system.service.*;
import cn.hutool.core.bean.BeanUtil;
import cn.hutool.core.lang.Opt;
import cn.hutool.core.util.ObjectUtil;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.List;
import java.util.function.Supplier;

/**
 * 登录校验方法
 * @author Pontus
 */
@RequiredArgsConstructor
@Slf4j
@Service
public class SysLoginServiceImpl implements SysLoginService {

    @Value("${user.password.maxRetryCount}")
    private Integer maxRetryCount;

    @Value("${user.password.lockTime}")
    private Integer lockTime;

    private final SysPermissionService permissionService;
    private final SysRoleService roleService;
    private final SysDeptService deptService;
    private final SysPostService postService;
    private final SysUserMapper userMapper;
    private final CurrentUserService currentUserService;
    private final SecurityTokenService tokenService;


    /**
     * 退出登录
     */
    public void logout() {
        SecurityTokenAuthentication authentication = currentUserService.getAuthentication();
        LoginUser loginUser = currentUserService.getLoginUser();
        if (!tokenService.revoke(authentication.accessToken())) {
            log.warn("Logout requested for an already revoked or missing token session, username={}", loginUser.getUsername());
        }
        recordLoginInfo(loginUser.getUsername(), Constants.LOGOUT, MessageUtils.message("user.logout.success"));
    }

    /**
     * 记录登录信息
     *
     * @param username 用户名
     * @param status   状态
     * @param message  消息内容
     */
    public void recordLoginInfo(String username, String status, String message) {
        LoginInfoEvent loginInfoEvent = new LoginInfoEvent();
        loginInfoEvent.setUsername(username);
        loginInfoEvent.setStatus(status);
        loginInfoEvent.setMessage(message);
        loginInfoEvent.setRequest(resolveCurrentRequest());
        SpringUtils.context().publishEvent(loginInfoEvent);
    }

    /**
     * 构建登录用户
     */
    public LoginUser buildLoginUser(SysUserVo user) {
        LoginUser loginUser = new LoginUser();
        Long userId = user.getUserId();
        loginUser.setUserId(userId);
        loginUser.setDeptId(user.getDeptId());
        loginUser.setUsername(user.getUserName());
        loginUser.setNickname(user.getNickName());
        loginUser.setUserType(user.getUserType());
        loginUser.setMenuPermission(permissionService.getMenuPermission(userId));
        loginUser.setRolePermission(permissionService.getRolePermission(userId));
        if (ObjectUtil.isNotNull(user.getDeptId())) {
            Opt<SysDeptVo> deptOpt = Opt.of(user.getDeptId()).map(deptService::selectDeptById);
            loginUser.setDeptName(deptOpt.map(SysDeptVo::getDeptName).orElse(StringUtils.EMPTY));
            loginUser.setDeptCategory(deptOpt.map(SysDeptVo::getDeptCategory).orElse(StringUtils.EMPTY));
        }
        List<SysRoleVo> roles = roleService.selectRolesByUserId(userId);
        List<SysPostVo> posts = postService.selectPostsByUserId(userId);
        loginUser.setRoles(BeanUtil.copyToList(roles, RoleDTO.class));
        loginUser.setPosts(BeanUtil.copyToList(posts, PostDTO.class));
        return loginUser;
    }

    /**
     * 记录登录信息
     *
     * @param userId 用户ID
     */
    public void recordLoginInfo(Long userId, String ip) {
        var now = DateUtils.getNowDate();
        DataPermissionHelper.ignore(() -> userMapper.update(null, new UpdateWrapper<SysUser>()
            .set("login_ip", ip)
            .set("login_date", now)
            .set("update_by", userId)
            .set("update_time", now)
            .eq("user_id", userId)));
    }

    /**
     * 登录校验
     */
    public void checkLogin(LoginType loginType, String username, Supplier<Boolean> supplier) {
        String errorKey = CacheConstants.PWD_ERR_CNT_KEY + username;
        String loginFail = Constants.LOGIN_FAIL;

        // 获取用户登录错误次数，默认为0 (可自定义限制策略 例如: key + username + ip)
        int errorNumber = ObjectUtil.defaultIfNull(RedisUtils.getCacheObject(errorKey), 0);
        // 锁定时间内登录 则踢出
        if (errorNumber >= maxRetryCount) {
            recordLoginInfo(username, loginFail, MessageUtils.message(loginType.getRetryLimitExceed(), maxRetryCount, lockTime));
            throw new UserException(loginType.getRetryLimitExceed(), maxRetryCount, lockTime);
        }

        if (supplier.get()) {
            // 错误次数递增
            errorNumber++;
            RedisUtils.setCacheObject(errorKey, errorNumber, Duration.ofMinutes(lockTime));
            // 达到规定错误次数 则锁定登录
            if (errorNumber >= maxRetryCount) {
                recordLoginInfo(username, loginFail, MessageUtils.message(loginType.getRetryLimitExceed(), maxRetryCount, lockTime));
                throw new UserException(loginType.getRetryLimitExceed(), maxRetryCount, lockTime);
            } else {
                // 未达到规定错误次数
                recordLoginInfo(username, loginFail, MessageUtils.message(loginType.getRetryLimitCount(), errorNumber));
                throw new UserException(loginType.getRetryLimitCount(), errorNumber);
            }
        }

        // 登录成功 清空错误次数
        RedisUtils.deleteObject(errorKey);
    }

    @Override
    public void invalidateUserSessions(Long userId, String userType) {
        String loginId = userType + ":" + userId;
        tokenService.revokeByLoginId(loginId);
    }

    private HttpServletRequest resolveCurrentRequest() {
        try {
            return ServletUtils.getRequest();
        } catch (IllegalStateException ignored) {
            return null;
        }
    }
}
