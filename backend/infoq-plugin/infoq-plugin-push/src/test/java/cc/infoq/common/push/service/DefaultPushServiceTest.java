package cc.infoq.common.push.service;

import cc.infoq.common.push.config.PushProperties;
import cc.infoq.common.push.domain.*;
import cc.infoq.common.sse.utils.SseMessageUtils;
import cc.infoq.common.utils.SpringUtils;
import cc.infoq.common.websocket.utils.WebSocketUtils;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.slf4j.LoggerFactory;
import org.springframework.context.support.GenericApplicationContext;
import org.springframework.core.env.MapPropertySource;

import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@Tag("dev")
class DefaultPushServiceTest {
    @BeforeAll static void context() {
        GenericApplicationContext context = new GenericApplicationContext();
        context.getEnvironment().getPropertySources().addFirst(new MapPropertySource("test", Map.of("sse.enabled", false)));
        context.refresh();
        new SpringUtils().setApplicationContext(context);
    }

    private PushRequest request() { return new PushRequest("correlation-1", 7L, List.of(new PushRecipient(10L), new PushRecipient(11L)), "private-payload"); }

    @Test void publishesBothChannelsWithoutClaimingDelivery() {
        PushProperties properties = new PushProperties();
        properties.setSseEnabled(true); properties.setWebsocketEnabled(true);
        try (MockedStatic<SseMessageUtils> sse = mockStatic(SseMessageUtils.class);
             MockedStatic<WebSocketUtils> ws = mockStatic(WebSocketUtils.class)) {
            sse.when(SseMessageUtils::isEnable).thenReturn(true);
            ws.when(() -> WebSocketUtils.publishMessage(any())).thenReturn(2);
            PushResult result = new DefaultPushService(properties).push(request());
            assertEquals(Set.of(PushChannel.SSE, PushChannel.WEBSOCKET), result.channels());
            assertEquals(2, result.recipientCount());
            assertTrue(result.outcomes().values().stream().allMatch(item -> item.status().equals("published") && item.connectionState().equals("unknown")));
            sse.verify(() -> SseMessageUtils.publishMessage(any()), times(1));
            ws.verify(() -> WebSocketUtils.publishMessage(any()), times(1));
        }
    }

    @Test void channelFailureDoesNotHideOtherChannelAndNeverLogsPayloadOrCauseMessage() {
        PushProperties properties = new PushProperties();
        properties.setSseEnabled(true); properties.setWebsocketEnabled(true);
        Logger logger = (Logger) LoggerFactory.getLogger(DefaultPushService.class);
        ListAppender<ILoggingEvent> appender = new ListAppender<>(); appender.start(); logger.addAppender(appender);
        try (MockedStatic<SseMessageUtils> sse = mockStatic(SseMessageUtils.class);
             MockedStatic<WebSocketUtils> ws = mockStatic(WebSocketUtils.class)) {
            sse.when(SseMessageUtils::isEnable).thenReturn(true);
            sse.when(() -> SseMessageUtils.publishMessage(any())).thenThrow(new IllegalStateException("private-payload secret-token"));
            ws.when(() -> WebSocketUtils.publishMessage(any())).thenReturn(2);
            PushResult result = new DefaultPushService(properties).push(request());
            assertEquals("failed", result.outcomes().get(PushChannel.SSE).status());
            assertEquals("IllegalStateException", result.outcomes().get(PushChannel.SSE).exceptionType());
            assertEquals(Set.of(PushChannel.WEBSOCKET), result.channels());
            assertEquals(2, appender.list.size());
            assertTrue(appender.list.stream().allMatch(event -> event.getThrowableProxy() == null
                && !event.getFormattedMessage().contains("private-payload") && !event.getFormattedMessage().contains("secret-token")
                && event.getFormattedMessage().contains("correlation-1") && event.getFormattedMessage().contains("messageId:7")));
        } finally { logger.detachAppender(appender); appender.stop(); }
    }

    @Test void offlineDisabledUnavailableAndEmptyHaveExplicitResults() {
        PushProperties properties = new PushProperties(); properties.setWebsocketEnabled(true);
        try (MockedStatic<WebSocketUtils> ws = mockStatic(WebSocketUtils.class)) {
            PushResult offline = new DefaultPushService(properties).push(request());
            assertEquals("offline", offline.outcomes().get(PushChannel.WEBSOCKET).status());
            assertEquals("disabled", offline.outcomes().get(PushChannel.SSE).status());
            properties.setWebsocketEnabled(false);
            assertEquals("channel_unavailable", new DefaultPushService(properties).push(request()).outcomes().get(PushChannel.WEBSOCKET).status());
            ws.clearInvocations();
            PushResult empty = new DefaultPushService(properties).push(new PushRequest("empty", 8L, List.of(), "ignored"));
            assertTrue(empty.outcomes().values().stream().allMatch(item -> item.status().equals("no_recipients")));
            ws.verifyNoInteractions();
        }
    }
}
