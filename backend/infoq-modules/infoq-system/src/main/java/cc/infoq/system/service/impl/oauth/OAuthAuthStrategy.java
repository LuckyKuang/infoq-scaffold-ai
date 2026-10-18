package cc.infoq.system.service.impl.oauth;

import cc.infoq.common.constant.SystemConstants;
import cc.infoq.common.domain.dto.UserOnlineDTO;
import cc.infoq.common.domain.model.LoginUser;
import cc.infoq.common.domain.model.OAuthLoginBody;
import cc.infoq.common.exception.ServiceException;
import cc.infoq.common.exception.user.UserException;
import cc.infoq.common.json.utils.JsonUtils;
import cc.infoq.common.oauth.domain.OAuthLoginTicketPayload;
import cc.infoq.common.oauth.service.OAuthLoginTicketService;
import cc.infoq.common.oauth.support.OAuthBrowserBinding;
import cc.infoq.common.security.auth.SecurityIssuedToken;
import cc.infoq.common.security.auth.SecurityTokenService;
import cc.infoq.common.utils.MessageUtils;
import cc.infoq.common.utils.ServletUtils;
import cc.infoq.common.utils.StringUtils;
import cc.infoq.common.utils.ValidatorUtils;
import cc.infoq.system.domain.entity.SysUser;
import cc.infoq.system.domain.vo.LoginVo;
import cc.infoq.system.domain.vo.SysClientVo;
import cc.infoq.system.domain.vo.SysUserVo;
import cc.infoq.system.listener.UserActionListener;
import cc.infoq.system.mapper.SysUserMapper;
import cc.infoq.system.service.AuthStrategy;
import cc.infoq.system.service.SysLoginService;
import cn.hutool.core.util.ObjectUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service("oauth" + AuthStrategy.BASE_NAME)
@RequiredArgsConstructor
public class OAuthAuthStrategy implements AuthStrategy {

    private final OAuthLoginTicketService ticketService;
    private final SysUserMapper userMapper;
    private final SysLoginService loginService;
    private final SecurityTokenService tokenService;
    private final UserActionListener userActionListener;

    @Override
    public AuthStrategy.LoginResult loginForResult(String body, SysClientVo client) {
        OAuthLoginBody loginBody = JsonUtils.parseObjectStrict(body, OAuthLoginBody.class);
        ValidatorUtils.validate(loginBody);
        if (!SystemConstants.GRANT_TYPE_OAUTH.equals(loginBody.getGrantType())) {
            throw new ServiceException(MessageUtils.message("auth.grant.type.error"));
        }
        String browserBinding = OAuthBrowserBinding.resolve(resolveCurrentRequest());
        OAuthLoginTicketPayload payload = ticketService.consumeTicket(loginBody.getLoginTicket(), browserBinding);
        if (!StringUtils.equals(client.getClientId(), payload.getClientId())) {
            throw new ServiceException(MessageUtils.message("auth.oauth.ticket.invalid"));
        }

        SysUserVo user = loadUserById(payload.getUserId());
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

    private SysUserVo loadUserById(Long userId) {
        SysUserVo user = userMapper.selectVoOne(new LambdaQueryWrapper<SysUser>()
            .eq(SysUser::getUserId, userId));
        if (ObjectUtil.isNull(user)) {
            log.info("OAuth login user id: {} does not exist.", userId);
            throw new UserException("user.not.exists", userId);
        } else if (SystemConstants.DISABLE.equals(user.getStatus())) {
            log.info("OAuth login user id: {} is disabled.", userId);
            throw new UserException("user.blocked", user.getUserName());
        }
        return user;
    }

    private HttpServletRequest resolveCurrentRequest() {
        try {
            return ServletUtils.getRequest();
        } catch (IllegalStateException ignored) {
            return null;
        }
    }
}
