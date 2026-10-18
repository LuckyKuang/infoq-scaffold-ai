package cc.infoq.common.oauth.service;

import cc.infoq.common.exception.ServiceException;
import cc.infoq.common.oauth.config.properties.OAuthProperties;
import cc.infoq.common.oauth.domain.OAuthLoginTicketPayload;
import cc.infoq.common.oauth.support.OAuthPkceUtils;
import cc.infoq.common.utils.MessageUtils;
import cc.infoq.common.utils.StringUtils;
import org.redisson.api.RBucket;
import org.redisson.api.RedissonClient;

public class OAuthLoginTicketService {

    private static final String TICKET_KEY_PREFIX = "oauth:ticket:";

    private final RedissonClient redissonClient;
    private final OAuthProperties properties;

    public OAuthLoginTicketService(RedissonClient redissonClient, OAuthProperties properties) {
        this.redissonClient = redissonClient;
        this.properties = properties;
    }

    public String createTicket(OAuthLoginTicketPayload payload) {
        return createTicket(payload, "");
    }

    /**
     * 创建带业务前缀的一次性票据。前缀仅用于回调场景区分，票据仍由高熵随机值构成。
     */
    public String createTicket(OAuthLoginTicketPayload payload, String prefix) {
        String ticket = StringUtils.blankToDefault(prefix, "") + OAuthPkceUtils.secureToken();
        payload.setIssuedAt(System.currentTimeMillis());
        RBucket<OAuthLoginTicketPayload> bucket = redissonClient.getBucket(buildKey(ticket));
        bucket.set(payload, properties.getTicketTtl());
        return ticket;
    }

    public OAuthLoginTicketPayload consumeTicket(String ticket, String browserBinding) {
        if (StringUtils.isBlank(ticket)) {
            throw new ServiceException(MessageUtils.message("auth.oauth.ticket.invalid"));
        }
        RBucket<OAuthLoginTicketPayload> bucket = redissonClient.getBucket(buildKey(ticket));
        OAuthLoginTicketPayload payload = bucket.getAndDelete();
        if (payload == null) {
            throw new ServiceException(MessageUtils.message("auth.oauth.ticket.invalid"));
        }
        if (!StringUtils.equals(payload.getBrowserBinding(), browserBinding)) {
            throw new ServiceException(MessageUtils.message("auth.oauth.ticket.invalid"));
        }
        return payload;
    }

    private String buildKey(String ticket) {
        return TICKET_KEY_PREFIX + ticket;
    }
}
