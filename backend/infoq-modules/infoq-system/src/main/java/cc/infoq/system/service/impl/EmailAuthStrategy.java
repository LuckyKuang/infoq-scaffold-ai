package cc.infoq.system.service.impl;

import cc.infoq.common.constant.SystemConstants;
import cc.infoq.common.domain.dto.UserOnlineDTO;
import cc.infoq.common.domain.model.EmailLoginBody;
import cc.infoq.common.domain.model.LoginUser;
import cc.infoq.common.enums.EmailCodeScene;
import cc.infoq.common.enums.LoginType;
import cc.infoq.common.exception.user.UserException;
import cc.infoq.common.json.utils.JsonUtils;
import cc.infoq.common.security.auth.SecurityIssuedToken;
import cc.infoq.common.security.auth.SecurityTokenService;
import cc.infoq.common.utils.ValidatorUtils;
import cc.infoq.system.domain.entity.SysUser;
import cc.infoq.system.domain.vo.LoginVo;
import cc.infoq.system.domain.vo.SysClientVo;
import cc.infoq.system.domain.vo.SysUserVo;
import cc.infoq.system.listener.UserActionListener;
import cc.infoq.system.mapper.SysUserMapper;
import cc.infoq.system.service.AuthEmailCodeService;
import cc.infoq.system.service.AuthStrategy;
import cc.infoq.system.service.SysLoginService;
import cn.hutool.core.util.ObjectUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * 邮件认证策略
 *
 * @author Pontus
 */
@Slf4j
@Service("email" + AuthStrategy.BASE_NAME)
@AllArgsConstructor
public class EmailAuthStrategy implements AuthStrategy {

    private final SysLoginService loginService;
    private final SysUserMapper userMapper;
    private final AuthEmailCodeService authEmailCodeService;
    private final SecurityTokenService tokenService;
    private final UserActionListener userActionListener;

    @Override
    public AuthStrategy.LoginResult loginForResult(String body, SysClientVo client) {
        EmailLoginBody loginBody = JsonUtils.parseObjectStrict(body, EmailLoginBody.class);
        ValidatorUtils.validate(loginBody);
        String email = loginBody.getEmail();
        String emailCode = loginBody.getEmailCode();
        SysUserVo user = loadUserByEmail(email);
        loginService.checkLogin(LoginType.EMAIL, user.getUserName(), () -> !authEmailCodeService.validateCode(EmailCodeScene.EMAIL_LOGIN, email, emailCode));
        // 此处可根据登录用户的数据不同 自行创建 loginUser 属性不够用继承扩展就行了
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

    private SysUserVo loadUserByEmail(String email) {
        SysUserVo user = userMapper.selectVoOne(new LambdaQueryWrapper<SysUser>().eq(SysUser::getEmail, email));
        if (ObjectUtil.isNull(user)) {
            log.info("登录用户：{} 不存在.", email);
            throw new UserException("user.not.exists", email);
        } else if (SystemConstants.DISABLE.equals(user.getStatus())) {
            log.info("登录用户：{} 已被停用.", email);
            throw new UserException("user.blocked", email);
        }
        return user;
    }

}
