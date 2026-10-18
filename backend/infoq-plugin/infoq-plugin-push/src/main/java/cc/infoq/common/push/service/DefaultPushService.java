package cc.infoq.common.push.service;

import cc.infoq.common.push.config.PushProperties;
import cc.infoq.common.push.domain.PushChannel;
import cc.infoq.common.push.domain.PushRecipient;
import cc.infoq.common.push.domain.PushRequest;
import cc.infoq.common.push.domain.PushResult;
import cc.infoq.common.sse.dto.SseMessageDto;
import cc.infoq.common.sse.utils.SseMessageUtils;
import cc.infoq.common.websocket.dto.WebSocketMessageDto;
import cc.infoq.common.websocket.utils.WebSocketUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import java.util.EnumMap;
import java.util.Map;
import java.util.List;

@Slf4j
@RequiredArgsConstructor
public class DefaultPushService implements PushService {

    private final PushProperties properties;

    @Override
    public PushResult push(PushRequest request) {
        List<Long> userIds = request.recipients() == null ? List.of()
            : request.recipients().stream().map(PushRecipient::userId).distinct().toList();
        Map<PushChannel, PushResult.ChannelResult> outcomes = new EnumMap<>(PushChannel.class);
        for (PushChannel channel : PushChannel.values()) {
            String status = "disabled";
            String connection = "unknown";
            String exceptionType = "none";
            boolean enabled = channel == PushChannel.SSE ? properties.isSseEnabled() : properties.isWebsocketEnabled();
            try {
                if (userIds.isEmpty()) status = "no_recipients";
                else if (!properties.isSseEnabled() && !properties.isWebsocketEnabled()) status = "channel_unavailable";
                else if (enabled && channel == PushChannel.SSE) {
                    if (!SseMessageUtils.isEnable()) status = "channel_unavailable";
                    else {
                        SseMessageDto message = new SseMessageDto();
                        message.setUserIds(userIds);
                        message.setMessage(request.payload());
                        message.setCorrelationId(request.correlationId());
                        message.setMessageId(request.messageId());
                        SseMessageUtils.publishMessage(message);
                        status = "published";
                    }
                } else if (enabled) {
                    WebSocketMessageDto message = new WebSocketMessageDto();
                    message.setSessionKeys(userIds);
                    message.setMessage(request.payload());
                    message.setCorrelationId(request.correlationId());
                    message.setMessageId(request.messageId());
                    int routedRecipients = WebSocketUtils.publishMessage(message);
                    status = routedRecipients == 0 ? "offline" : "published";
                    connection = routedRecipients == 0 ? "offline" : "unknown";
                }
            } catch (RuntimeException e) {
                status = "failed";
                exceptionType = e.getClass().getSimpleName();
            }
            outcomes.put(channel, new PushResult.ChannelResult(status, connection, exceptionType));
            if ("failed".equals(status) || "channel_unavailable".equals(status)) {
                log.warn("Push result, correlationId:{}, messageId:{}, recipients:{}, channel:{}, status:{}, connection:{}, type:{}",
                    request.correlationId(), request.messageId(), userIds.size(), channel, status, connection, exceptionType);
            } else {
                log.info("Push result, correlationId:{}, messageId:{}, recipients:{}, channel:{}, status:{}, connection:{}, type:{}",
                    request.correlationId(), request.messageId(), userIds.size(), channel, status, connection, exceptionType);
            }
        }
        return new PushResult(request.correlationId(), request.messageId(), userIds.size(), outcomes);
    }
}
