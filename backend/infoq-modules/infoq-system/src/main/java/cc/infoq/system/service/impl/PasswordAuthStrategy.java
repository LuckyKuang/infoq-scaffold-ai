package cc.infoq.system.service.impl;

import cc.infoq.common.constant.Constants;
import cc.infoq.common.constant.GlobalConstants;
import cc.infoq.common.constant.SystemConstants;
import cc.infoq.common.domain.dto.UserOnlineDTO;
import cc.infoq.common.domain.model.LoginUser;
import cc.infoq.common.domain.model.PasswordLoginBody;
import cc.infoq.common.enums.LoginType;
import cc.infoq.common.exception.user.CaptchaException;
import cc.infoq.common.exception.user.CaptchaExpireException;
import cc.infoq.common.exception.user.UserException;
import cc.infoq.common.json.utils.JsonUtils;
import cc.infoq.common.redis.utils.RedisUtils;
import cc.infoq.common.security.auth.SecurityIssuedToken;
import cc.infoq.common.security.auth.SecurityTokenService;
import cc.infoq.common.utils.MessageUtils;
import cc.infoq.common.utils.StringUtils;
import cc.infoq.common.utils.ValidatorUtils;
import cc.infoq.common.web.config.properties.CaptchaProperties;
import cc.infoq.system.domain.entity.SysUser;
import cc.infoq.system.domain.vo.LoginVo;
import cc.infoq.system.domain.vo.SysClientVo;
import cc.infoq.system.domain.vo.SysUserVo;
import cc.infoq.system.listener.UserActionListener;
import cc.infoq.system.mapper.SysUserMapper;
import cc.infoq.system.service.AuthStrategy;
import cc.infoq.system.service.SysLoginService;
import cn.hutool.core.util.ObjectUtil;
import cn.hutool.crypto.digest.BCrypt;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * 密码认证策略
 *
 * @author Pontus
 */
@Slf4j
@Service("password" + AuthStrategy.BASE_NAME)
@AllArgsConstructor
public class PasswordAuthStrategy implements AuthStrategy {

    private final CaptchaProperties captchaProperties;
    private final SysLoginService loginService;
    private final SysUserMapper userMapper;
    private final SecurityTokenService tokenService;
    private final UserActionListener userActionListener;

    @Override
    public AuthStrategy.LoginResult loginForResult(String body, SysClientVo client) {
        PasswordLoginBody loginBody = JsonUtils.parseObjectStrict(body, PasswordLoginBody.class);
        ValidatorUtils.validate(loginBody);
        String username = loginBody.getUsername();
        String password = loginBody.getPassword();
        String code = loginBody.getCode();
        String uuid = loginBody.getUuid();

        boolean captchaEnabled = captchaProperties.getEnable();
        // 验证码开关
        if (captchaEnabled) {
            validateCaptcha(username, code, uuid);
        }
        SysUserVo user = loadUserByUsername(username);
        loginService.checkLogin(LoginType.PASSWORD, username, () -> !BCrypt.checkpw(password, user.getPassword()));
        // 构建登录用户信息（包含权限、角色、岗位等上下文）
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

    /**
     * 校验验证码
     *
     * @param username 用户名
     * @param code     验证码
     * @param uuid     唯一标识
     */
    private void validateCaptcha(String username, String code, String uuid) {
        String verifyKey = GlobalConstants.CAPTCHA_CODE_KEY + StringUtils.blankToDefault(uuid, "");
        String captcha = RedisUtils.getCacheObject(verifyKey);
        RedisUtils.deleteObject(verifyKey);
        if (captcha == null) {
            loginService.recordLoginInfo(username, Constants.LOGIN_FAIL, MessageUtils.message("user.jcaptcha.expire"));
            throw new CaptchaExpireException();
        }
        if (!StringUtils.equalsIgnoreCase(code, captcha)) {
            loginService.recordLoginInfo(username, Constants.LOGIN_FAIL, MessageUtils.message("user.jcaptcha.error"));
            throw new CaptchaException();
        }
    }

    private SysUserVo loadUserByUsername(String username) {
        SysUserVo user = userMapper.selectVoOne(new LambdaQueryWrapper<SysUser>().eq(SysUser::getUserName, username));
        if (ObjectUtil.isNull(user)) {
            log.info("登录用户：{} 不存在.", username);
            throw new UserException("user.not.exists", username);
        } else if (SystemConstants.DISABLE.equals(user.getStatus())) {
            log.info("登录用户：{} 已被停用.", username);
            throw new UserException("user.blocked", username);
        }
        return user;
    }

}
