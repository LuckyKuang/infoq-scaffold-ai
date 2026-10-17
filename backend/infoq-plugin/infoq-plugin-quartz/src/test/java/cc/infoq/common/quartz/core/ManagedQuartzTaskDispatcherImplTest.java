package cc.infoq.common.quartz.core;

import cc.infoq.common.exception.ServiceException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;

@Tag("dev")
class ManagedQuartzTaskDispatcherImplTest {

    @Test
    @DisplayName("supportedHandlerKeys/supports: should expose registered handler keys")
    void supportedHandlerKeysShouldExposeRegisteredHandlers() {
        ManagedQuartzTaskDispatcherImpl dispatcher = new ManagedQuartzTaskDispatcherImpl(List.of(
            new StaticTaskHandler("system.noop"),
            new StaticTaskHandler("demo.echo")
        ));

        Set<String> keys = dispatcher.supportedHandlerKeys();

        assertEquals(Set.of("system.noop", "demo.echo"), keys);
        assertTrue(dispatcher.supports("system.noop"));
        assertTrue(dispatcher.supports("demo.echo"));
    }

    @Test
    @DisplayName("dispatch: should invoke matching handler with params")
    void dispatchShouldInvokeMatchingHandler() {
        AtomicReference<Map<String, Object>> executedParams = new AtomicReference<>();
        ManagedQuartzTaskDispatcherImpl dispatcher = new ManagedQuartzTaskDispatcherImpl(List.of(
            new ManagedQuartzTaskHandler() {
                @Override
                public String handlerKey() {
                    return "system.noop";
                }

                @Override
                public void execute(Map<String, Object> params) {
                    executedParams.set(params);
                }
            }
        ));
        Map<String, Object> payload = Map.of("traceId", "t-1");

        dispatcher.dispatch("system.noop", payload);

        assertEquals(payload, executedParams.get());
    }

    @Test
    @DisplayName("dispatch: should fail explicitly when handler is not registered")
    void dispatchShouldFailWhenHandlerMissing() {
        ManagedQuartzTaskDispatcherImpl dispatcher = new ManagedQuartzTaskDispatcherImpl(List.of(new StaticTaskHandler("system.noop")));

        ServiceException exception = assertThrows(ServiceException.class, () -> dispatcher.dispatch("missing.handler", Map.of()));

        assertInstanceOf(ServiceException.class, exception);
        assertTrue(exception.getMessage().contains("missing.handler"));
    }

    private record StaticTaskHandler(String handlerKey) implements ManagedQuartzTaskHandler {
        @Override
        public void execute(Map<String, Object> params) {
            // no-op
        }
    }
}
