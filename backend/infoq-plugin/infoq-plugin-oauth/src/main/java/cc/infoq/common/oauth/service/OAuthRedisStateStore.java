package cc.infoq.common.oauth.service;

import cc.infoq.common.exception.ServiceException;
import cc.infoq.common.oauth.config.properties.OAuthProperties;
import cc.infoq.common.oauth.domain.OAuthPendingSession;
import cc.infoq.common.utils.MessageUtils;
import cc.infoq.common.utils.StringUtils;
import org.redisson.api.RBucket;
import org.redisson.api.RedissonClient;

public class OAuthRedisStateStore {

    private static final String STATE_KEY_PREFIX = "oauth:state:";

    private final RedissonClient redissonClient;
    private final OAuthProperties properties;

    public OAuthRedisStateStore(RedissonClient redissonClient, OAuthProperties properties) {
        this.redissonClient = redissonClient;
        this.properties = properties;
    }

    public void save(OAuthPendingSession pendingSession) {
        RBucket<OAuthPendingSession> bucket = redissonClient.getBucket(buildKey(pendingSession.getProviderCode(), pendingSession.getState()));
        bucket.set(pendingSession, properties.getStateTtl());
    }

    public OAuthPendingSession consume(String providerCode, String state) {
        if (StringUtils.isBlank(state)) {
            throw new ServiceException(MessageUtils.message("auth.oauth.state.invalid"));
        }
        RBucket<OAuthPendingSession> bucket = redissonClient.getBucket(buildKey(providerCode, state));
        OAuthPendingSession session = bucket.getAndDelete();
        if (session == null) {
            throw new ServiceException(MessageUtils.message("auth.oauth.state.invalid"));
        }
        return session;
    }

    private String buildKey(String providerCode, String state) {
        return STATE_KEY_PREFIX + providerCode + ":" + state;
    }
}
