package cc.infoq.system.event;

import java.util.List;

public record SystemMessageCommittedEvent(String correlationId, Long messageId, List<Long> recipientUserIds) {
}
