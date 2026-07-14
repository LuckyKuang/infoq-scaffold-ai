package cc.infoq.common.push.config;

import cc.infoq.common.push.service.PushService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

@Tag("dev")
class PushAutoConfigurationTest {

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
        .withConfiguration(AutoConfigurations.of(PushAutoConfiguration.class));

    @Test
    @DisplayName("disabled: should not create PushService")
    void disabledShouldNotCreatePushService() {
        contextRunner.run(context -> assertNull(context.getBeanProvider(PushService.class).getIfAvailable()));
    }

    @Test
    @DisplayName("enabled without channel: should fail explicitly")
    void enabledWithoutChannelShouldFailExplicitly() {
        contextRunner.withPropertyValues("infoq.push.enabled=true").run(context -> assertNotNull(context.getStartupFailure()));
    }

    @Test
    @DisplayName("SSE enabled without SSE infrastructure: should fail explicitly")
    void sseWithoutInfrastructureShouldFailExplicitly() {
        contextRunner.withPropertyValues("infoq.push.enabled=true", "infoq.push.sse-enabled=true")
            .run(context -> assertNotNull(context.getStartupFailure()));
    }

    @Test
    @DisplayName("SSE enabled with infrastructure: should create PushService")
    void sseWithInfrastructureShouldCreatePushService() {
        contextRunner.withPropertyValues("infoq.push.enabled=true", "infoq.push.sse-enabled=true", "sse.enabled=true")
            .run(context -> assertNotNull(context.getBean(PushService.class)));
    }
}
