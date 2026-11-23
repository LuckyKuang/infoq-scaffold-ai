package cc.infoq.system.controller.monitor;

import cc.infoq.common.constant.CacheConstants;
import cc.infoq.common.domain.ApiResult;
import cc.infoq.common.domain.dto.UserOnlineDTO;
import cc.infoq.common.log.annotation.Log;
import cc.infoq.common.log.enums.BusinessType;
import cc.infoq.common.mybatis.core.page.TableDataInfo;
import cc.infoq.common.redis.annotation.RepeatSubmit;
import cc.infoq.common.redis.utils.RedisUtils;
import cc.infoq.common.security.auth.*;
import cc.infoq.common.utils.StreamUtils;
import cc.infoq.common.utils.StringUtils;
import cc.infoq.common.web.core.BaseController;
import cc.infoq.system.domain.entity.SysUserOnline;
import cn.hutool.core.bean.BeanUtil;
import lombok.AllArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * 在线用户监控
 *
 * @author Pontus
 */
@AllArgsConstructor
@RestController
@RequestMapping("/monitor/online")
public class SysUserOnlineController extends BaseController {

    private final SecurityTokenService tokenService;
    private final SecurityTokenStore tokenStore;
    private final CurrentUserService currentUserService;

    /**
     * 获取在线用户监控列表
     *
     * @param ipaddr   IP地址
     * @param userName 用户名
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('monitor:online:list')")
    @GetMapping("/list")
    public TableDataInfo<SysUserOnline> list(String ipaddr, String userName) {
        // 获取在线 token 索引后批量加载 session，避免在线用户多时逐条访问 Redis。
        Collection<String> keys = RedisUtils.keys(CacheConstants.ONLINE_TOKEN_KEY + "*");
        Map<String, String> digestByToken = new LinkedHashMap<>();
        for (String key : keys) {
            String token = StringUtils.substringAfterLast(key, ":");
            if (StringUtils.isBlank(token)) {
                continue;
            }
            digestByToken.put(token, tokenService.digest(token));
        }
        Map<String, SecurityTokenSession> sessionsByDigest = tokenStore.findByDigests(digestByToken.values());
        List<SysUserOnline> userOnlineList = toOnlineList(digestByToken.values(), sessionsByDigest);
        if (StringUtils.isNotEmpty(ipaddr)) {
            userOnlineList = StreamUtils.filter(userOnlineList, userOnline -> StringUtils.equals(ipaddr, userOnline.getIpaddr()));
        }
        if (StringUtils.isNotEmpty(userName)) {
            userOnlineList = StreamUtils.filter(userOnlineList, userOnline -> StringUtils.equals(userName, userOnline.getUserName()));
        }
        Collections.reverse(userOnlineList);
        return TableDataInfo.build(userOnlineList);
    }

    /**
     * 强退用户
     *
     * @param tokenId 会话摘要（列表返回的 tokenId，不是原始 access token）
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('monitor:online:forceLogout')")
    @Log(title = "在线用户", businessType = BusinessType.FORCE)
    @RepeatSubmit()
    @DeleteMapping("/{tokenId}")
    public ApiResult<Void> forceLogout(@PathVariable String tokenId) {
        tokenStore.revoke(null, tokenId);
        return ApiResult.ok();
    }

    /**
     * 获取当前用户登录在线设备
     */
    @GetMapping()
    public TableDataInfo<SysUserOnline> getInfo() {
        SecurityTokenAuthentication authentication = currentUserService.getAuthentication();
        Set<String> tokenDigests = tokenStore.findTokenDigestsByLoginId(authentication.session().getLoginId());
        Map<String, SecurityTokenSession> sessionsByDigest = tokenStore.findByDigests(tokenDigests);
        List<SysUserOnline> userOnlineList = toOnlineList(tokenDigests, sessionsByDigest);
        Collections.reverse(userOnlineList);
        return TableDataInfo.build(userOnlineList);
    }

    /**
     * 强退当前在线设备
     *
     * @param tokenId 会话摘要（列表返回的 tokenId，不是原始 access token）
     */
    @Log(title = "在线设备", businessType = BusinessType.FORCE)
    @RepeatSubmit()
    @DeleteMapping("/myself/{tokenId}")
    public ApiResult<Void> remove(@PathVariable("tokenId") String tokenId) {
        SecurityTokenAuthentication authentication = currentUserService.getAuthentication();
        tokenStore.findByDigest(tokenId)
            .filter(session -> StringUtils.equals(authentication.session().getLoginId(), session.getLoginId()))
            .ifPresent(session -> tokenStore.revoke(null, tokenId));
        return ApiResult.ok();
    }

    private boolean isActive(SecurityTokenSession session) {
        long now = System.currentTimeMillis();
        return session != null && !session.isExpired(now) && !session.isActiveExpired(now);
    }

    /**
     * 组装在线会话；tokenId 只暴露会话摘要，避免原始 access token 经监控接口泄露导致会话被接管
     */
    private List<SysUserOnline> toOnlineList(Collection<String> digests, Map<String, SecurityTokenSession> sessionsByDigest) {
        List<SysUserOnline> result = new ArrayList<>();
        for (String digest : digests) {
            SecurityTokenSession session = sessionsByDigest.get(digest);
            if (!isActive(session)) {
                continue;
            }
            UserOnlineDTO onlineUser = resolveOnlineUser(session);
            if (onlineUser == null) {
                continue;
            }
            SysUserOnline online = BeanUtil.copyProperties(onlineUser, SysUserOnline.class);
            online.setTokenId(digest);
            result.add(online);
        }
        return result;
    }

    private UserOnlineDTO resolveOnlineUser(SecurityTokenSession session) {
        UserOnlineDTO onlineUser = session.getOnlineUser();
        if (onlineUser == null && StringUtils.isNotBlank(session.getAccessToken())) {
            onlineUser = RedisUtils.getCacheObject(CacheConstants.ONLINE_TOKEN_KEY + session.getAccessToken());
        }
        return onlineUser;
    }

}
