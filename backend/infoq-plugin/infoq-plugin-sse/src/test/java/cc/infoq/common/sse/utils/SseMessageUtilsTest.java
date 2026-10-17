package cc.infoq.common.sse.utils;

import cc.infoq.common.sse.core.SseEmitterManager;
import cc.infoq.common.sse.dto.SseMessageDto;
import cc.infoq.common.utils.SpringUtils;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.context.support.GenericApplicationContext;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

@Tag("dev")
class SseMessageUtilsTest {

    private static GenericApplicationContext context;
    private static SseEmitterManager manager;

    @BeforeAll
    static void initContext() throws ClassNotFoundException {
        manager = mock(SseEmitterManager.class);
        context = new GenericApplicationContext();
        context.registerBean(SseEmitterManager.class, () -> manager);
        context.refresh();
        new SpringUtils().setApplicationContext(context);
        Class.forName(SseMessageUtils.class.getName());
    }

    @AfterAll
    static void closeContext() {
        if (context != null) {
            context.close();
        }
    }

    @Test
    @DisplayName("send/publish: should delegate to manager when sse enabled")
    void sendAndPublishShouldDelegateToManager() {
        SseMessageDto dto = new SseMessageDto();
        dto.setUserIds(List.of(1L, 2L));
        dto.setMessage("hello");

        SseMessageUtils.sendMessage(1L, "u-message");
        SseMessageUtils.sendMessage("broadcast");
        SseMessageUtils.publishMessage(dto);
        SseMessageUtils.publishAll("all-message");

        verify(manager).sendMessage(1L, "u-message");
        verify(manager).sendMessage("broadcast");
        verify(manager).publishMessage(dto);
        verify(manager).publishAll("all-message");
    }

    @Test
    @DisplayName("isEnable: should default to true")
    void isEnableShouldReturnTrue() {
        assertTrue(SseMessageUtils.isEnable());
    }
}
