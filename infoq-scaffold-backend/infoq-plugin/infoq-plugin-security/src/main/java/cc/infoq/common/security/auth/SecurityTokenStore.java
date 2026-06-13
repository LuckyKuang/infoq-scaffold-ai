package cc.infoq.common.security.auth;

import cc.infoq.common.constant.CacheConstants;
import cc.infoq.common.domain.dto.RoleDTO;
import cc.infoq.common.domain.dto.UserOnlineDTO;
import cc.infoq.common.domain.model.LoginUser;
import cc.infoq.common.redis.utils.RedisUtils;
import cc.infoq.common.utils.StringUtils;
import org.redisson.api.RSet;

import java.time.Duration;
import java.util.*;

public class SecurityTokenStore {

    public void save(String accessToken, SecurityTokenSession session) {
        validateSession(accessToken, session);
        Duration ttl = sessionTtl(session);
        storeSession(session, ttl);
        storeOnlineUser(accessToken, session, ttl);
        addIndex(loginIndexKey(session.getLoginId()), session.getTokenDigest(), ttl);
        addIndex(userIndexKey(session.getUserId()), session.getTokenDigest(), ttl);
        for (Long roleId : session.getRoleIds()) {
            addIndex(roleIndexKey(roleId), session.getTokenDigest(), ttl);
        }
    }

    public Optional<SecurityTokenSession> findByDigest(String tokenDigest) {
        if (StringUtils.isBlank(tokenDigest) || isRevoked(tokenDigest)) {
            return Optional.empty();
        }
        return Optional.ofNullable(RedisUtils.getCacheObject(sessionKey(tokenDigest)));
    }

    public boolean isRevoked(String tokenDigest) {
        return StringUtils.isNotBlank(tokenDigest) && RedisUtils.isExistsObject(revokedKey(tokenDigest));
    }

    public void touch(SecurityTokenSession session, Duration activeTimeout) {
        if (session == null || activeTimeout == null || activeTimeout.isNegative() || activeTimeout.isZero()) {
            return;
        }
        long now = System.currentTimeMillis();
        session.setLastAccessTime(now);
        session.setActiveExpireTime(now + activeTimeout.toMillis());
        storeSession(session, sessionTtl(session));
    }

    public boolean revoke(String accessToken, String tokenDigest) {
        SecurityTokenSession session = RedisUtils.getCacheObject(sessionKey(tokenDigest));
        return revokeLoadedSession(accessToken, tokenDigest, session);
    }

    private boolean revokeLoadedSession(String accessToken, String tokenDigest, SecurityTokenSession session) {
        markRevoked(tokenDigest, sessionTtl(session));
        RedisUtils.deleteObject(sessionKey(tokenDigest));
        if (StringUtils.isNotBlank(accessToken)) {
            RedisUtils.deleteObject(CacheConstants.ONLINE_TOKEN_KEY + accessToken);
        } else if (session != null && StringUtils.isNotBlank(session.getAccessToken())) {
            RedisUtils.deleteObject(CacheConstants.ONLINE_TOKEN_KEY + session.getAccessToken());
        }
        removeIndexes(tokenDigest, session);
        return session != null;
    }

    public int revokeByLoginId(String loginId) {
        return revokeDigests(readIndex(loginIndexKey(loginId)));
    }

    public int revokeByUserId(Long userId) {
        return revokeDigests(readIndex(userIndexKey(userId)));
    }

    public int revokeByRoleId(Long roleId) {
        return revokeDigests(readIndex(roleIndexKey(roleId)));
    }

    public Set<String> findTokenDigestsByLoginId(String loginId) {
        return readIndex(loginIndexKey(loginId));
    }

    public Set<String> findTokenDigestsByUserId(Long userId) {
        return readIndex(userIndexKey(userId));
    }

    public Set<String> findTokenDigestsByRoleId(Long roleId) {
        return readIndex(roleIndexKey(roleId));
    }

    String sessionKey(String tokenDigest) {
        return SecurityAuthNames.TOKEN_SESSION_KEY_PREFIX + tokenDigest;
    }

    String revokedKey(String tokenDigest) {
        return SecurityAuthNames.TOKEN_REVOKED_KEY_PREFIX + tokenDigest;
    }

    String loginIndexKey(String loginId) {
        return SecurityAuthNames.TOKEN_LOGIN_INDEX_KEY_PREFIX + loginId;
    }

    String userIndexKey(Long userId) {
        return SecurityAuthNames.TOKEN_USER_INDEX_KEY_PREFIX + userId;
    }

    String roleIndexKey(Long roleId) {
        return SecurityAuthNames.TOKEN_ROLE_INDEX_KEY_PREFIX + roleId;
    }

    Set<Long> extractRoleIds(LoginUser loginUser) {
        Set<Long> roleIds = new HashSet<>();
        if (loginUser == null || loginUser.getRoles() == null) {
            return roleIds;
        }
        for (RoleDTO role : loginUser.getRoles()) {
            if (role != null && role.getRoleId() != null) {
                roleIds.add(role.getRoleId());
            }
        }
        return roleIds;
    }

    private void validateSession(String accessToken, SecurityTokenSession session) {
        if (StringUtils.isBlank(accessToken)) {
            throw new SecurityAuthenticationException("access token is required");
        }
        if (session == null) {
            throw new SecurityAuthenticationException("token session is required");
        }
        if (StringUtils.isBlank(session.getTokenDigest())) {
            throw new SecurityAuthenticationException("token digest is required");
        }
        if (StringUtils.isBlank(session.getLoginId()) || session.getUserId() == null || StringUtils.isBlank(session.getUserType())) {
            throw new SecurityAuthenticationException("token session identity is incomplete");
        }
        if (StringUtils.isBlank(session.getClientId())) {
            throw new SecurityAuthenticationException("token session clientId is required");
        }
    }

    private void storeSession(SecurityTokenSession session, Duration ttl) {
        if (ttl == null) {
            RedisUtils.setCacheObject(sessionKey(session.getTokenDigest()), session);
        } else {
            RedisUtils.setCacheObject(sessionKey(session.getTokenDigest()), session, ttl);
        }
    }

    private void storeOnlineUser(String accessToken, SecurityTokenSession session, Duration ttl) {
        UserOnlineDTO onlineUser = resolveOnlineUser(accessToken, session);
        if (ttl == null) {
            RedisUtils.setCacheObject(CacheConstants.ONLINE_TOKEN_KEY + accessToken, onlineUser);
        } else {
            RedisUtils.setCacheObject(CacheConstants.ONLINE_TOKEN_KEY + accessToken, onlineUser, ttl);
        }
    }

    private UserOnlineDTO resolveOnlineUser(String accessToken, SecurityTokenSession session) {
        UserOnlineDTO onlineUser = session.getOnlineUser();
        if (onlineUser == null) {
            onlineUser = new UserOnlineDTO();
        }
        onlineUser.setTokenId(accessToken);
        if (session.getLoginUser() != null) {
            LoginUser loginUser = session.getLoginUser();
            onlineUser.setUserName(loginUser.getUsername());
            onlineUser.setDeptName(loginUser.getDeptName());
            onlineUser.setClientKey(loginUser.getClientKey());
            onlineUser.setDeviceType(loginUser.getDeviceType());
            onlineUser.setIpaddr(loginUser.getIpaddr());
            onlineUser.setLoginLocation(loginUser.getLoginLocation());
            onlineUser.setBrowser(loginUser.getBrowser());
            onlineUser.setOs(loginUser.getOs());
        }
        onlineUser.setClientKey(StringUtils.blankToDefault(onlineUser.getClientKey(), session.getClientId()));
        onlineUser.setDeviceType(StringUtils.blankToDefault(onlineUser.getDeviceType(), session.getDeviceType()));
        onlineUser.setLoginTime(session.getLoginTime());
        session.setOnlineUser(onlineUser);
        return onlineUser;
    }

    private Duration sessionTtl(SecurityTokenSession session) {
        if (session == null || session.getExpireTime() == null || session.getExpireTime() <= 0) {
            return null;
        }
        long millis = session.getExpireTime() - System.currentTimeMillis();
        if (millis <= 0) {
            return Duration.ofMillis(1);
        }
        return Duration.ofMillis(millis);
    }

    private void markRevoked(String tokenDigest, Duration ttl) {
        if (StringUtils.isBlank(tokenDigest)) {
            return;
        }
        if (ttl == null) {
            RedisUtils.setCacheObject(revokedKey(tokenDigest), Boolean.TRUE);
        } else {
            RedisUtils.setCacheObject(revokedKey(tokenDigest), Boolean.TRUE, ttl);
        }
    }

    private void addIndex(String key, String tokenDigest, Duration ttl) {
        RedisUtils.addCacheSet(key, tokenDigest);
        if (ttl != null) {
            RedisUtils.getClient().getSet(key).expire(ttl);
        }
    }

    private Set<String> readIndex(String key) {
        Set<String> digests = RedisUtils.getCacheSet(key);
        return digests == null ? Set.of() : Set.copyOf(digests);
    }

    private int revokeDigests(Collection<String> digests) {
        if (digests.isEmpty()) {
            return 0;
        }
        String[] sessionKeys = digests.stream().map(this::sessionKey).toArray(String[]::new);
        Map<String, SecurityTokenSession> sessionsByKey = RedisUtils.getClient().getBuckets().get(sessionKeys);
        int count = 0;
        for (String digest : digests) {
            SecurityTokenSession session = sessionsByKey.get(sessionKey(digest));
            String accessToken = session == null ? null : session.getAccessToken();
            if (revokeLoadedSession(accessToken, digest, session)) {
                count++;
            }
        }
        return count;
    }

    private void removeIndexes(String tokenDigest, SecurityTokenSession session) {
        if (session == null) {
            return;
        }
        removeIndex(loginIndexKey(session.getLoginId()), tokenDigest);
        removeIndex(userIndexKey(session.getUserId()), tokenDigest);
        for (Long roleId : session.getRoleIds()) {
            removeIndex(roleIndexKey(roleId), tokenDigest);
        }
    }

    private void removeIndex(String key, String tokenDigest) {
        RSet<String> set = RedisUtils.getClient().getSet(key);
        set.remove(tokenDigest);
    }

}
