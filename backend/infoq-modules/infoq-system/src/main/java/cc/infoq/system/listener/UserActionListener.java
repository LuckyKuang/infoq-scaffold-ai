package cc.infoq.system.listener;

import cc.infoq.common.constant.Constants;
import cc.infoq.common.domain.dto.UserOnlineDTO;
import cc.infoq.common.domain.model.LoginUser;
import cc.infoq.common.log.event.LoginInfoEvent;
import cc.infoq.common.security.auth.SecurityTokenSession;
import cc.infoq.common.utils.MessageUtils;
import cc.infoq.common.utils.ServletUtils;
import cc.infoq.common.utils.SpringUtils;
import cc.infoq.common.utils.StringUtils;
import cc.infoq.common.utils.ip.AddressUtils;
import cc.infoq.system.service.SysLoginService;
import cn.hutool.http.useragent.UserAgent;
import cn.hutool.http.useragent.UserAgentUtil;
import jakarta.servlet.http.HttpServletRequest;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 用户认证行为辅助组件。
 *
 * @author Pontus
 */
@AllArgsConstructor
@Component
@Slf4j
public class UserActionListener {

    private static final String CLIENT_KEY_HEADER = "x-client-key";
    private static final String DEVICE_TYPE_HEADER = "x-device-type";

    private final SysLoginService loginService;

    /**
     * 构建 token store 可直接写入的在线用户 metadata。
     */
    public UserOnlineDTO buildOnlineUser(LoginUser loginUser, String clientId, String deviceType) {
        LoginUser requiredLoginUser = requireLoginUser(loginUser);
        HttpServletRequest request = resolveCurrentRequest();
        UserAgent userAgent = request != null ? UserAgentUtil.parse(request.getHeader("User-Agent")) : null;
        String ip = request != null ? ServletUtils.getClientIP() : StringUtils.EMPTY;
        String loginLocation = AddressUtils.getRealAddressByIP(ip);
        String browser = userAgent != null && userAgent.getBrowser() != null ? userAgent.getBrowser().getName() : StringUtils.EMPTY;
        String os = userAgent != null && userAgent.getOs() != null ? userAgent.getOs().getName() : StringUtils.EMPTY;
        String resolvedClientId = resolveHeaderOrDefault(request, CLIENT_KEY_HEADER,
            StringUtils.blankToDefault(clientId, requiredLoginUser.getClientKey()));
        String resolvedDeviceType = resolveHeaderOrDefault(request, DEVICE_TYPE_HEADER,
            StringUtils.blankToDefault(deviceType, requiredLoginUser.getDeviceType()));

        requiredLoginUser.setIpaddr(ip);
        requiredLoginUser.setLoginLocation(loginLocation);
        requiredLoginUser.setBrowser(browser);
        requiredLoginUser.setOs(os);
        requiredLoginUser.setClientKey(resolvedClientId);
        requiredLoginUser.setDeviceType(resolvedDeviceType);

        UserOnlineDTO dto = new UserOnlineDTO();
        dto.setIpaddr(ip);
        dto.setLoginLocation(loginLocation);
        dto.setBrowser(browser);
        dto.setOs(os);
        dto.setLoginTime(System.currentTimeMillis());
        dto.setTokenId(requiredLoginUser.getToken());
        dto.setUserName(requiredLoginUser.getUsername());
        dto.setClientKey(resolvedClientId);
        dto.setDeviceType(resolvedDeviceType);
        dto.setDeptName(requiredLoginUser.getDeptName());
        return dto;
    }

    /**
     * token 签发成功后记录登录审计和最近登录信息。
     */
    public void recordLoginSuccess(SecurityTokenSession session) {
        if (session == null) {
            throw new IllegalArgumentException("token session is required");
        }
        LoginUser loginUser = requireLoginUser(session.getLoginUser());
        if (session.getOnlineUser() == null) {
            session.setOnlineUser(buildOnlineUser(loginUser, session.getClientId(), session.getDeviceType()));
        }
        if (StringUtils.isNotBlank(session.getAccessToken())) {
            session.getOnlineUser().setTokenId(session.getAccessToken());
        }
        recordLoginSuccess(loginUser);
    }

    /**
     * token 签发成功后记录登录审计和最近登录信息。
     */
    public void recordLoginSuccess(LoginUser loginUser) {
        LoginUser requiredLoginUser = requireLoginUser(loginUser);
        HttpServletRequest request = resolveCurrentRequest();
        String ip = StringUtils.blankToDefault(requiredLoginUser.getIpaddr(),
            request != null ? ServletUtils.getClientIP() : StringUtils.EMPTY);
        // 记录登录日志
        LoginInfoEvent loginInfoEvent = new LoginInfoEvent();
        loginInfoEvent.setUsername(requiredLoginUser.getUsername());
        loginInfoEvent.setStatus(Constants.LOGIN_SUCCESS);
        loginInfoEvent.setMessage(MessageUtils.message("user.login.success"));
        loginInfoEvent.setRequest(request);
        SpringUtils.context().publishEvent(loginInfoEvent);
        // 更新登录信息
        loginService.recordLoginInfo(requiredLoginUser.getUserId(), ip);
        log.info("user login success, userId:{}", requiredLoginUser.getUserId());
    }

    private HttpServletRequest resolveCurrentRequest() {
        try {
            return ServletUtils.getRequest();
        } catch (IllegalStateException ignored) {
            return null;
        }
    }

    private String resolveHeaderOrDefault(HttpServletRequest request, String headerName, String defaultValue) {
        if (request == null) {
            return defaultValue;
        }
        return StringUtils.blankToDefault(request.getHeader(headerName), defaultValue);
    }

    private LoginUser requireLoginUser(LoginUser loginUser) {
        if (loginUser == null) {
            throw new IllegalArgumentException("loginUser is required");
        }
        if (loginUser.getUserId() == null) {
            throw new IllegalArgumentException("loginUser.userId is required");
        }
        return loginUser;
    }
}
