package cc.infoq.common.websocket.holder;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.WebSocketSession;

import java.util.ArrayList;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@Tag("dev")
class WebSocketSessionHolderTest {

    @AfterEach
    void clearSessions() {
        new ArrayList<>(WebSocketSessionHolder.getSessionsAll()).forEach(WebSocketSessionHolder::removeSession);
    }

    @Test
    @DisplayName("session holder: should keep multiple sessions for the same user and remove individually")
    void sessionHolderShouldKeepMultipleSessionsAndRemoveIndividually() {
        WebSocketSession sessionA = mock(WebSocketSession.class);
        when(sessionA.getId()).thenReturn("a");
        WebSocketSession sessionB = mock(WebSocketSession.class);
        when(sessionB.getId()).thenReturn("b");

        WebSocketSessionHolder.addSession(1L, sessionA);
        WebSocketSessionHolder.addSession(1L, sessionB);

        assertTrue(WebSocketSessionHolder.existSession(1L));
        assertEquals(2, WebSocketSessionHolder.sessionCount(1L));

        WebSocketSessionHolder.removeSession(1L, "a");

        assertTrue(WebSocketSessionHolder.existSession(1L));
        assertEquals(1, WebSocketSessionHolder.sessionCount(1L));

        WebSocketSessionHolder.removeSession(1L);

        assertFalse(WebSocketSessionHolder.existSession(1L));
    }

    @Test
    @DisplayName("session holder: removeSession(user) should close all tracked sessions")
    void removeSessionShouldCloseAllTrackedSessions() throws Exception {
        WebSocketSession sessionA = mock(WebSocketSession.class);
        when(sessionA.getId()).thenReturn("a");
        WebSocketSession sessionB = mock(WebSocketSession.class);
        when(sessionB.getId()).thenReturn("b");

        WebSocketSessionHolder.addSession(2L, sessionA);
        WebSocketSessionHolder.addSession(2L, sessionB);

        WebSocketSessionHolder.removeSession(2L);

        verify(sessionA).close(org.springframework.web.socket.CloseStatus.NORMAL);
        verify(sessionB).close(org.springframework.web.socket.CloseStatus.NORMAL);
    }
}
