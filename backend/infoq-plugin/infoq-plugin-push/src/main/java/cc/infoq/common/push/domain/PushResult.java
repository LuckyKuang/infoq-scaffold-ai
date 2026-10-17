package cc.infoq.common.push.domain;

import java.util.Set;

/**
 * Push 处理结果，不包含投递正文或用户明细。
 */
public record PushResult(String correlationId, Long messageId, int recipientCount, Set<PushChannel> channels) {

    public static PushResult skipped(PushRequest request) {
        return new PushResult(request.correlationId(), request.messageId(), 0, Set.of());
    }
}
