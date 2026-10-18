package cc.infoq.system.controller.login;

import cc.infoq.common.constant.Constants;
import cc.infoq.common.domain.ApiResult;
import cc.infoq.common.security.auth.CurrentUserService;
import cc.infoq.common.security.auth.SecurityTokenSession;
import cc.infoq.common.security.browser.*;
import cc.infoq.common.utils.MessageUtils;
import cc.infoq.system.domain.vo.LoginVo;
import cc.infoq.system.service.SysLoginService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.redisson.client.RedisException;
import org.springframework.dao.DataAccessException;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping(BrowserSessionCookies.PATH)
public class BrowserSessionController {
    private final BrowserSessionService service;
    private final BrowserSessionCookies cookies;
    private final BrowserSessionCsrfRepository csrfRepository;
    private final CurrentUserService currentUserService;
    private final SysLoginService loginService;

    @GetMapping("/csrf")
    public ApiResult<Map<String, String>> csrf(HttpServletRequest request) {
        CsrfToken token = (CsrfToken) request.getAttribute(CsrfToken.class.getName());
        return ApiResult.ok(Map.of("token", token.getToken(), "headerName", token.getHeaderName()));
    }

    @PutMapping
    public ApiResult<Void> bind(HttpServletRequest request, HttpServletResponse response) {
        String clientId = request.getHeader("clientid");
        String scope = request.getHeader(BrowserSessionCookies.SCOPE_HEADER);
        var authentication = currentUserService.getAuthentication();
        BrowserSessionService.Created created = service.bind(authentication, clientId, scope, cookies.read(request, scope, clientId));
        cookies.write(response, scope, clientId, created.handle(), created.maxAge());
        log.info("browser_session action=bind category=success clientId={} tokenDigest={} requestId={}",
            clientId, authentication.tokenDigest().substring(0, 12), request.getRequestId());
        return ApiResult.ok();
    }

    @PostMapping
    public ApiResult<LoginVo> restore(HttpServletRequest request) {
        String clientId = request.getHeader("clientid");
        String scope = request.getHeader(BrowserSessionCookies.SCOPE_HEADER);
        BrowserSessionService.Restored restored = service.restore(cookies.read(request, scope, clientId), clientId, scope);
        LoginVo result = new LoginVo();
        result.setAccessToken(restored.authentication().accessToken());
        result.setClientId(clientId);
        result.setExpireIn(restored.remainingSeconds());
        log.info("browser_session action=restore category=success clientId={} tokenDigest={} requestId={}",
            clientId, restored.authentication().tokenDigest().substring(0, 12), request.getRequestId());
        return ApiResult.ok(result);
    }

    @DeleteMapping
    public ApiResult<Void> delete(HttpServletRequest request, HttpServletResponse response) {
        String clientId = request.getHeader("clientid");
        String scope = request.getHeader(BrowserSessionCookies.SCOPE_HEADER);
        Optional<SecurityTokenSession> session = service.delete(cookies.read(request, scope, clientId), clientId, scope);
        clear(request, response);
        session.ifPresent(value -> loginService.recordLoginInfo(value.getLoginUser().getUsername(), Constants.LOGOUT,
            MessageUtils.message("user.logout.success")));
        log.info("browser_session action=delete category={} clientId={} requestId={}",
            session.isPresent() ? "revoked" : "already_missing", clientId, request.getRequestId());
        return ApiResult.ok();
    }

    @ExceptionHandler({BrowserSessionException.class, RedisException.class, DataAccessException.class})
    public ApiResult<Void> failure(RuntimeException exception, HttpServletRequest request, HttpServletResponse response) {
        int status = exception instanceof BrowserSessionException failure ? failure.status() : 503;
        String category = exception instanceof BrowserSessionException ? exception.getMessage() : "dependency_unavailable";
        if (status == 401 || "DELETE".equals(request.getMethod()) && status == 503) {
            clear(request, response);
        }
        response.setStatus(status);
        log.info("browser_session action={} category={} clientId={} requestId={} failureType={}", request.getMethod(), category,
            request.getHeader("clientid"), request.getRequestId(), exception.getClass().getSimpleName());
        return ApiResult.fail(status, category);
    }

    private void clear(HttpServletRequest request, HttpServletResponse response) {
        cookies.write(response, request.getHeader(BrowserSessionCookies.SCOPE_HEADER), request.getHeader("clientid"), "", 0);
        csrfRepository.saveToken(null, request, response);
    }
}
