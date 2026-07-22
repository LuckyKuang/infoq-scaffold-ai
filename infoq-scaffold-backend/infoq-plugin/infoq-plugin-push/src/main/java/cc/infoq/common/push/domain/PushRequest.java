package cc.infoq.common.push.domain;

import java.util.List;

/**
 * 不携带业务实体和正文的实时提醒请求。
 */
public record PushRequest(String correlationId, Long messageId, List<PushRecipient> recipients, String payload) {
}
