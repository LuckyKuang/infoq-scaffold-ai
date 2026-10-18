package cc.infoq.common.security.browser;

import cc.infoq.common.redis.utils.RedisUtils;
import java.io.Serializable;
import java.time.Duration;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

public class BrowserSessionStore {
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Binding implements Serializable {
        private String tokenDigest;
        private String clientId;
        private String scope;
        private long expiresAt;
    }

    public Binding find(String handle) {
        return RedisUtils.getCacheObject(key(handle));
    }

    public void save(String handle, Binding binding, Duration ttl) {
        if (!RedisUtils.setObjectIfAbsent(key(handle), binding, ttl)) {
            throw new BrowserSessionException(503, "handle_collision");
        }
    }

    public void delete(String handle) {
        RedisUtils.deleteObject(key(handle));
    }

    String key(String handle) {
        return "security:browser-session:" + BrowserSessionCookies.digest(handle);
    }
}
