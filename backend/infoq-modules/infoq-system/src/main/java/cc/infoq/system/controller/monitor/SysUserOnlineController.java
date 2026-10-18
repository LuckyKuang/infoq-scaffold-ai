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
import java.util.stream.Collectors;

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
        List<UserOnlineDTO> userOnlineDTOList = digestByToken.values().stream()
            .map(sessionsByDigest::get)
            .filter(this::isActive)
            .map(this::resolveOnlineUser)
            .filter(Objects::nonNull)
            .collect(Collectors.toList());
        if (StringUtils.isNotEmpty(ipaddr) && StringUtils.isNotEmpty(userName)) {
            userOnlineDTOList = StreamUtils.filter(userOnlineDTOList, userOnline ->
                StringUtils.equals(ipaddr, userOnline.getIpaddr()) &&
                    StringUtils.equals(userName, userOnline.getUserName())
            );
        } else if (StringUtils.isNotEmpty(ipaddr)) {
            userOnlineDTOList = StreamUtils.filter(userOnlineDTOList, userOnline ->
                StringUtils.equals(ipaddr, userOnline.getIpaddr())
            );
        } else if (StringUtils.isNotEmpty(userName)) {
            userOnlineDTOList = StreamUtils.filter(userOnlineDTOList, userOnline ->
                StringUtils.equals(userName, userOnline.getUserName())
            );
        }
        Collections.reverse(userOnlineDTOList);
        userOnlineDTOList.removeAll(Collections.singleton(null));
        List<SysUserOnline> userOnlineList = BeanUtil.copyToList(userOnlineDTOList, SysUserOnline.class);
        return TableDataInfo.build(userOnlineList);
    }

    /**
     * 强退用户
     *
     * @param tokenId token值
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('monitor:online:forceLogout')")
    @Log(title = "在线用户", businessType = BusinessType.FORCE)
    @RepeatSubmit()
    @DeleteMapping("/{tokenId}")
    public ApiResult<Void> forceLogout(@PathVariable String tokenId) {
        tokenService.revoke(tokenId);
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
        List<UserOnlineDTO> userOnlineDTOList = tokenDigests.stream()
            .map(sessionsByDigest::get)
            .filter(this::isActive)
            .map(this::resolveOnlineUser)
            .filter(Objects::nonNull)
            .collect(Collectors.toList());
        //复制和处理 SysUserOnline 对象列表
        Collections.reverse(userOnlineDTOList);
        userOnlineDTOList.removeAll(Collections.singleton(null));
        List<SysUserOnline> userOnlineList = BeanUtil.copyToList(userOnlineDTOList, SysUserOnline.class);
        return TableDataInfo.build(userOnlineList);
    }

    /**
     * 强退当前在线设备
     *
     * @param tokenId token值
     */
    @Log(title = "在线设备", businessType = BusinessType.FORCE)
    @RepeatSubmit()
    @DeleteMapping("/myself/{tokenId}")
    public ApiResult<Void> remove(@PathVariable("tokenId") String tokenId) {
        SecurityTokenAuthentication authentication = currentUserService.getAuthentication();
        String tokenDigest = tokenService.digest(tokenId);
        tokenStore.findByDigest(tokenDigest)
            .filter(session -> StringUtils.equals(authentication.session().getLoginId(), session.getLoginId()))
            .ifPresent(session -> tokenService.revoke(tokenId));
        return ApiResult.ok();
    }

    private boolean isActive(SecurityTokenSession session) {
        long now = System.currentTimeMillis();
        return session != null && !session.isExpired(now) && !session.isActiveExpired(now);
    }

    private UserOnlineDTO resolveOnlineUser(SecurityTokenSession session) {
        UserOnlineDTO onlineUser = session.getOnlineUser();
        if (onlineUser == null && StringUtils.isNotBlank(session.getAccessToken())) {
            onlineUser = RedisUtils.getCacheObject(CacheConstants.ONLINE_TOKEN_KEY + session.getAccessToken());
        }
        return onlineUser;
    }

}
