package cc.infoq.system.support.plugin;

import cc.infoq.common.exception.ServiceException;
import cc.infoq.common.utils.SpringUtils;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.context.support.GenericApplicationContext;
import org.springframework.mock.env.MockEnvironment;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

@Tag("dev")
class OptionalSseHelperTest {

    private GenericApplicationContext context;

    @AfterEach
    void tearDown() {
        if (context != null) {
            context.close();
        }
    }

    @Test
    @DisplayName("publish helpers: should skip silently when sse is disabled")
    void publishHelpersShouldSkipWhenDisabled() {
        MockEnvironment environment = new MockEnvironment();
        environment.setProperty("sse.enabled", "false");

        context = new GenericApplicationContext();
        context.setEnvironment(environment);
        context.refresh();
        new SpringUtils().setApplicationContext(context);

        assertDoesNotThrow(() -> OptionalSseHelper.publishToUsers(List.of(1L, 2L), "msg"));
        assertDoesNotThrow(() -> OptionalSseHelper.publishAll("msg"));
    }

    @Test
    @DisplayName("publish helpers: should fail explicitly when sse is enabled but plugin is unavailable")
    void publishHelpersShouldFailWhenEnabledButPluginUnavailable() {
        MockEnvironment environment = new MockEnvironment();
        environment.setProperty("sse.enabled", "true");

        context = new GenericApplicationContext();
        context.setEnvironment(environment);
        context.refresh();
        new SpringUtils().setApplicationContext(context);

        assertThrows(ServiceException.class, () -> OptionalSseHelper.publishToUsers(List.of(1L), "msg"));
        assertThrows(ServiceException.class, () -> OptionalSseHelper.publishAll("msg"));
    }
}
