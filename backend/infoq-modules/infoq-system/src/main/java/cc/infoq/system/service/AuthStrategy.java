package cc.infoq.system.service;


import cc.infoq.common.domain.dto.UserOnlineDTO;
import cc.infoq.common.domain.model.LoginUser;
import cc.infoq.common.exception.ServiceException;
import cc.infoq.common.security.auth.SecurityIssuedToken;
import cc.infoq.common.security.auth.SecurityTokenIssueRequest;
import cc.infoq.common.utils.SpringUtils;
import cc.infoq.system.domain.vo.LoginVo;
import cc.infoq.system.domain.vo.SysClientVo;

import java.util.Objects;

/**
 * 授权策略
 *
 * @author Pontus
 */
public interface AuthStrategy {

    String BASE_NAME = "AuthStrategy";

    /**
     * 登录
     *
     * @param body      登录对象
     * @param client    授权管理视图对象
     * @param grantType 授权类型
     * @return 登录验证信息
     */
    static LoginVo login(String body, SysClientVo client, String grantType) {
        return loginForResult(body, client, grantType).loginVo();
    }

    static LoginResult loginForResult(String body, SysClientVo client, String grantType) {
        // 授权类型和客户端id
        String beanName = grantType + BASE_NAME;
        if (!SpringUtils.containsBean(beanName)) {
            throw new ServiceException("授权类型不正确!");
        }
        AuthStrategy instance = SpringUtils.getBean(beanName);
        return instance.loginForResult(body, client);
    }

    static SecurityTokenIssueRequest createIssueRequest(LoginUser loginUser, SysClientVo client) {
        return createIssueRequest(loginUser, client, null);
    }

    static SecurityTokenIssueRequest createIssueRequest(LoginUser loginUser, SysClientVo client, UserOnlineDTO onlineUser) {
        return new SecurityTokenIssueRequest(
            loginUser,
            client.getClientId(),
            client.getDeviceType(),
            client.getTimeout(),
            client.getActiveTimeout(),
            onlineUser
        );
    }

    static LoginVo createLoginVo(SecurityIssuedToken issuedToken, SysClientVo client) {
        LoginVo loginVo = new LoginVo();
        loginVo.setAccessToken(issuedToken.accessToken());
        loginVo.setExpireIn(issuedToken.expiresIn());
        loginVo.setClientId(client.getClientId());
        return loginVo;
    }

    /**
     * 登录
     *
     * @param body   登录对象
     * @param client 授权管理视图对象
     * @return 登录验证信息
     */
    default LoginVo login(String body, SysClientVo client) {
        return loginForResult(body, client).loginVo();
    }

    /**
     * 登录并返回内部上下文。
     *
     * @param body   登录对象
     * @param client 授权管理视图对象
     * @return 登录验证信息和当前用户标识
     */
    LoginResult loginForResult(String body, SysClientVo client);

    record LoginResult(LoginVo loginVo, Long userId) {
        public LoginResult {
            Objects.requireNonNull(loginVo, "loginVo must not be null");
        }
    }

}
