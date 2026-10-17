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

import java.util.EnumSet;
import java.util.List;
import java.util.Set;

@Slf4j
@RequiredArgsConstructor
public class DefaultPushService implements PushService {

    private final PushProperties properties;

    @Override
    public PushResult push(PushRequest request) {
        if (request.recipients() == null || request.recipients().isEmpty()) {
            return PushResult.skipped(request);
        }
        List<Long> userIds = request.recipients().stream().map(PushRecipient::userId).toList();
        Set<PushChannel> channels = EnumSet.noneOf(PushChannel.class);
        if (properties.isSseEnabled()) {
            SseMessageDto message = new SseMessageDto();
            message.setUserIds(userIds);
            message.setMessage(request.payload());
            SseMessageUtils.publishMessage(message);
            channels.add(PushChannel.SSE);
        }
        if (properties.isWebsocketEnabled()) {
            WebSocketMessageDto message = new WebSocketMessageDto();
            message.setSessionKeys(userIds);
            message.setMessage(request.payload());
            WebSocketUtils.publishMessage(message);
            channels.add(PushChannel.WEBSOCKET);
        }
        log.info("Push delivered, correlationId:{}, messageId:{}, recipients:{}, channels:{}",
            request.correlationId(), request.messageId(), userIds.size(), channels);
        return new PushResult(request.correlationId(), request.messageId(), userIds.size(), Set.copyOf(channels));
    }
}
