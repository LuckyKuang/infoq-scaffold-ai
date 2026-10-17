package cc.infoq.system.support.plugin;

import cc.infoq.common.exception.ServiceException;
import cc.infoq.common.utils.SpringUtils;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.context.support.GenericApplicationContext;
import org.springframework.mock.env.MockEnvironment;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Tag("dev")
class OptionalMailHelperTest {

    private GenericApplicationContext context;

    @AfterEach
    void tearDown() {
        if (context != null) {
            context.close();
        }
    }

    @Test
    @DisplayName("isEnabled: should return true when mail.enabled=true")
    void isEnabledShouldReturnTrueWhenPropertyTrue() {
        initContext("mail.enabled", "true");

        assertTrue(OptionalMailHelper.isEnabled());
    }

    @Test
    @DisplayName("isEnabled: should return false when mail.enabled=false")
    void isEnabledShouldReturnFalseWhenPropertyFalse() {
        initContext("mail.enabled", "false");

        assertFalse(OptionalMailHelper.isEnabled());
    }

    @Test
    @DisplayName("sendText: should throw service exception when mail runtime is unavailable")
    void sendTextShouldThrowWhenMailRuntimeUnavailable() {
        initContext("mail.enabled", "true");

        assertThrows(ServiceException.class, () -> OptionalMailHelper.sendText("a@b.com", "subject", "body"));
    }

    private void initContext(String key, String value) {
        MockEnvironment environment = new MockEnvironment();
        environment.setProperty(key, value);

        context = new GenericApplicationContext();
        context.setEnvironment(environment);
        context.refresh();
        new SpringUtils().setApplicationContext(context);
    }
}
