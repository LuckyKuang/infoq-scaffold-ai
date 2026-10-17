package cc.infoq.common.websocket.listener;

import cc.infoq.common.websocket.dto.WebSocketMessageDto;
import cc.infoq.common.websocket.holder.WebSocketSessionHolder;
import cc.infoq.common.websocket.utils.WebSocketUtils;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.springframework.boot.ApplicationArguments;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;

@Tag("dev")
class WebSocketTopicListenerTest {

    @Test
    @DisplayName("run: should subscribe both global topic and current node topic")
    void runShouldSubscribeGlobalAndNodeTopics() throws Exception {
        try (MockedStatic<WebSocketUtils> webSocketUtils = mockStatic(WebSocketUtils.class)) {
            WebSocketTopicListener listener = new WebSocketTopicListener();

            listener.run(mock(ApplicationArguments.class));

            webSocketUtils.verify(() -> WebSocketUtils.subscribeMessage(any()));
            webSocketUtils.verify(() -> WebSocketUtils.subscribeNodeMessage(any()));
            assertEquals(-1, listener.getOrder());
        }
    }

    @Test
    @DisplayName("dispatchMessage: should route targeted websocket message only to existing local users")
    void dispatchMessageShouldRouteTargetedMessageToExistingSessions() {
        try (MockedStatic<WebSocketUtils> webSocketUtils = mockStatic(WebSocketUtils.class);
             MockedStatic<WebSocketSessionHolder> sessionHolder = mockStatic(WebSocketSessionHolder.class)) {
            sessionHolder.when(() -> WebSocketSessionHolder.existSession(1L)).thenReturn(true);
            sessionHolder.when(() -> WebSocketSessionHolder.existSession(2L)).thenReturn(false);

            WebSocketTopicListener listener = new WebSocketTopicListener();
            WebSocketMessageDto dto = new WebSocketMessageDto();
            dto.setSessionKeys(List.of(1L, 2L));
            dto.setMessage("hello");

            listener.dispatchMessage(dto);

            webSocketUtils.verify(() -> WebSocketUtils.sendMessage(1L, "hello"));
            webSocketUtils.verify(() -> WebSocketUtils.sendMessage(2L, "hello"), never());
        }
    }

    @Test
    @DisplayName("dispatchMessage: should broadcast websocket message when session keys are empty")
    void dispatchMessageShouldBroadcastWhenSessionKeysEmpty() {
        try (MockedStatic<WebSocketUtils> webSocketUtils = mockStatic(WebSocketUtils.class);
             MockedStatic<WebSocketSessionHolder> sessionHolder = mockStatic(WebSocketSessionHolder.class)) {
            sessionHolder.when(WebSocketSessionHolder::getSessionsAll).thenReturn(Set.of(10L, 11L));

            WebSocketTopicListener listener = new WebSocketTopicListener();
            WebSocketMessageDto dto = new WebSocketMessageDto();
            dto.setMessage("broadcast");

            listener.dispatchMessage(dto);

            webSocketUtils.verify(() -> WebSocketUtils.sendMessage(10L, "broadcast"));
            webSocketUtils.verify(() -> WebSocketUtils.sendMessage(11L, "broadcast"));
        }
    }
}
