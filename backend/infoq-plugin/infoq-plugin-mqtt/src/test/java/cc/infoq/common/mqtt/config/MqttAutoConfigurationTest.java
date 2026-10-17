package cc.infoq.common.mqtt.config;

import cc.infoq.common.mqtt.*;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import static org.junit.jupiter.api.Assertions.*;

@Tag("dev")
class MqttAutoConfigurationTest {

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
        .withConfiguration(AutoConfigurations.of(MqttAutoConfiguration.class));

    @Test
    void shouldNotCreateClientOrStatusProviderWhenPluginIsDisabled() {
        contextRunner.run(context -> {
            assertFalse(context.containsBean("mqttClientRegistry"));
            assertTrue(context.getBeansOfType(MqttStatusProvider.class).isEmpty());
            assertThrows(MqttUnavailableException.class, () -> context.getBean(MqttPublisher.class).publish(
                new MqttPublishCommand(MqttProtocol.V3_1_1, "device/event", new byte[0], 0, false, null)));
        });
    }

    @Test
    void shouldRejectEnabledPluginWithoutProtocol() {
        contextRunner.withPropertyValues("infoq.mqtt.enabled=true").run(context ->
            assertNotNull(context.getStartupFailure()));
    }
}
