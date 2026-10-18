package cc.infoq.common.push.domain;

import java.util.Set;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Push 处理结果，不包含投递正文或用户明细。
 */
public record PushResult(String correlationId, Long messageId, int recipientCount, Map<PushChannel, ChannelResult> outcomes) {
    public PushResult {
        outcomes = Map.copyOf(outcomes);
    }

    /** 已发布的通道，不表示客户端收到。 */
    public Set<PushChannel> channels() {
        return outcomes.entrySet().stream().filter(entry -> "published".equals(entry.getValue().status()))
            .map(Map.Entry::getKey).collect(Collectors.toUnmodifiableSet());
    }

    public record ChannelResult(String status, String connectionState, String exceptionType) {}
}
