package cc.infoq.system.listener;

import cc.infoq.common.push.domain.PushRequest;
import cc.infoq.common.push.service.PushService;
import cc.infoq.system.event.SystemMessageCommittedEvent;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.*;

@Tag("dev")
class SysMessagePushListenerTest {

    @Test
    @DisplayName("onMessageCommitted: should only send a message event after persistence")
    void onMessageCommittedShouldPushOnlyMessageEvent() {
        ObjectProvider<PushService> provider = mock(ObjectProvider.class);
        PushService pushService = mock(PushService.class);
        when(provider.getIfAvailable()).thenReturn(pushService);

        new SysMessagePushListener(provider).onMessageCommitted(new SystemMessageCommittedEvent("message-7", 7L, List.of(10L)));

        org.mockito.ArgumentCaptor<PushRequest> request = org.mockito.ArgumentCaptor.forClass(PushRequest.class);
        verify(pushService).push(request.capture());
        assertEquals("message-7", request.getValue().correlationId());
        assertEquals(7L, request.getValue().messageId());
        assertEquals(List.of(10L), request.getValue().recipients().stream().map(item -> item.userId()).toList());
        assertEquals("{\"type\":\"message\",\"messageId\":7}", request.getValue().payload());
    }

    @Test
    @DisplayName("onMessageCommitted: should not require PushService when the plugin is disabled")
    void onMessageCommittedShouldSkipWhenPluginDisabled() {
        ObjectProvider<PushService> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(null);

        new SysMessagePushListener(provider).onMessageCommitted(new SystemMessageCommittedEvent("message-7", 7L, List.of(10L)));

        verify(provider).getIfAvailable();
    }
}
