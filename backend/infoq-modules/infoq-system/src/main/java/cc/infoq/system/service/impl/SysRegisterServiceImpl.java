package cc.infoq.system.service.impl;

import cc.infoq.common.constant.Constants;
import cc.infoq.common.constant.SystemConstants;
import cc.infoq.common.domain.model.RegisterBody;
import cc.infoq.common.enums.EmailCodeScene;
import cc.infoq.common.enums.UserType;
import cc.infoq.common.exception.ServiceException;
import cc.infoq.common.exception.user.UserException;
import cc.infoq.common.log.event.LoginInfoEvent;
import cc.infoq.common.mybatis.helper.DataPermissionHelper;
import cc.infoq.common.utils.MessageUtils;
import cc.infoq.common.utils.ServletUtils;
import cc.infoq.common.utils.SpringUtils;
import cc.infoq.common.utils.StringUtils;
import cc.infoq.system.domain.bo.SysUserBo;
import cc.infoq.system.domain.entity.SysPost;
import cc.infoq.system.domain.entity.SysRole;
import cc.infoq.system.mapper.SysDeptMapper;
import cc.infoq.system.mapper.SysPostMapper;
import cc.infoq.system.mapper.SysRoleMapper;
import cc.infoq.system.service.AuthEmailCodeService;
import cc.infoq.system.service.SysInviteCodeService;
import cc.infoq.system.service.SysRegisterService;
import cc.infoq.system.service.SysUserService;
import cn.hutool.crypto.digest.BCrypt;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import jakarta.servlet.http.HttpServletRequest;
import lombok.AllArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 注册校验服务
 *
 * @author Pontus
 */
@AllArgsConstructor
@Service
public class SysRegisterServiceImpl implements SysRegisterService {

    private final SysUserService userService;
    private final AuthEmailCodeService authEmailCodeService;
    private final SysInviteCodeService sysInviteCodeService;
    private final SysRoleMapper sysRoleMapper;
    private final SysPostMapper sysPostMapper;
    private final SysDeptMapper sysDeptMapper;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void register(RegisterBody registerBody) {
        String username = registerBody.getUsername();
        String password = registerBody.getPassword();
        String email = registerBody.getEmail();
        SysUserBo sysUser = buildRegisterUser(username, password, email);

        if (!authEmailCodeService.validateCode(EmailCodeScene.REGISTER, email, registerBody.getEmailCode())) {
            throw new UserException("user.jcaptcha.error");
        }
        if (StringUtils.isNotBlank(registerBody.getInviteCode())) {
            sysInviteCodeService.validateInviteCodeAvailable(registerBody.getInviteCode());
        }
        if (!userService.checkUserNameUnique(sysUser)) {
            throw new UserException("user.register.save.error", username);
        }
        if (!userService.checkEmailUnique(sysUser)) {
            throw new UserException("user.email.already.exists", email);
        }
        boolean regFlag = DataPermissionHelper.ignore(() -> userService.registerUser(sysUser));
        if (!regFlag) {
            throw new UserException("user.register.error");
        }
        if (StringUtils.isNotBlank(registerBody.getInviteCode())) {
            sysInviteCodeService.consumeInviteCode(registerBody.getInviteCode(), sysUser.getUserId());
        }
        recordLoginInfo(username, Constants.REGISTER, MessageUtils.message("user.register.success"));
    }

    private SysUserBo buildRegisterUser(String username, String password, String email) {
        SysUserBo sysUser = new SysUserBo();
        sysUser.setUserName(username);
        sysUser.setNickName(username);
        sysUser.setPassword(BCrypt.hashpw(password));
        sysUser.setEmail(email);
        sysUser.setUserType(UserType.SYS_USER.getUserType());
        sysUser.setDeptId(SystemConstants.REGISTER_DEFAULT_DEPT_ID);
        sysUser.setCreateDept(SystemConstants.REGISTER_DEFAULT_DEPT_ID);
        sysUser.setStatus(SystemConstants.NORMAL);
        sysUser.setRoleIds(new Long[]{resolveDefaultRoleId()});
        sysUser.setPostIds(new Long[]{resolveDefaultPostId()});
        return sysUser;
    }

    private Long resolveDefaultRoleId() {
        SysRole role = DataPermissionHelper.ignore(() -> sysRoleMapper.selectOne(new LambdaQueryWrapper<SysRole>()
            .select(SysRole::getRoleId)
            .eq(SysRole::getRoleKey, SystemConstants.REGISTER_DEFAULT_ROLE_KEY)
            .last("limit 1")));
        if (role == null || role.getRoleId() == null) {
            throw new ServiceException("未找到默认注册角色 " + SystemConstants.REGISTER_DEFAULT_ROLE_KEY);
        }
        return role.getRoleId();
    }

    private Long resolveDefaultPostId() {
        long deptCount = DataPermissionHelper.ignore(() -> sysDeptMapper.countDeptById(SystemConstants.REGISTER_DEFAULT_DEPT_ID));
        if (deptCount < 1) {
            throw new ServiceException("未找到默认注册部门 " + SystemConstants.REGISTER_DEFAULT_DEPT_ID);
        }
        SysPost post = DataPermissionHelper.ignore(() -> sysPostMapper.selectOne(new LambdaQueryWrapper<SysPost>()
            .select(SysPost::getPostId)
            .eq(SysPost::getPostCode, SystemConstants.REGISTER_DEFAULT_POST_CODE)
            .last("limit 1")));
        if (post == null || post.getPostId() == null) {
            throw new ServiceException("未找到默认注册岗位 " + SystemConstants.REGISTER_DEFAULT_POST_CODE);
        }
        return post.getPostId();
    }

    private void recordLoginInfo(String username, String status, String message) {
        LoginInfoEvent loginInfoEvent = new LoginInfoEvent();
        loginInfoEvent.setUsername(username);
        loginInfoEvent.setStatus(status);
        loginInfoEvent.setMessage(message);
        loginInfoEvent.setRequest(resolveCurrentRequest());
        SpringUtils.context().publishEvent(loginInfoEvent);
    }

    private HttpServletRequest resolveCurrentRequest() {
        try {
            return ServletUtils.getRequest();
        } catch (IllegalStateException ignored) {
            return null;
        }
    }
}
