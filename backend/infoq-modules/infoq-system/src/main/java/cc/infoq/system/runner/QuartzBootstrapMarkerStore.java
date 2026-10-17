package cc.infoq.system.runner;

import cc.infoq.common.redis.utils.RedisUtils;
import org.springframework.stereotype.Component;

/**
 * Quartz bootstrap marker 存取封装，隔离静态 Redis 工具调用。
 *
 * @author Pontus
 */
@Component
public class QuartzBootstrapMarkerStore {

    public boolean hasMarker(String key) {
        return Boolean.TRUE.equals(RedisUtils.hasKey(key));
    }

    public void markApplied(String key) {
        RedisUtils.setCacheObject(key, "applied");
    }
}
