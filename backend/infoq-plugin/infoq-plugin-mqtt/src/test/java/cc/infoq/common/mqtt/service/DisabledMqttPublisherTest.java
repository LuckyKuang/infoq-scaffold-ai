package cc.infoq.common.mqtt.service;

import cc.infoq.common.mqtt.MqttProtocol;
import cc.infoq.common.mqtt.MqttPublishCommand;
import cc.infoq.common.mqtt.MqttUnavailableException;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertThrows;

@Tag("dev")
class DisabledMqttPublisherTest {

    @Test
    void shouldFailExplicitlyWhenPluginIsDisabled() {
        DisabledMqttPublisher publisher = new DisabledMqttPublisher();

        assertThrows(MqttUnavailableException.class, () -> publisher.publish(new MqttPublishCommand(
            MqttProtocol.V3_1_1, "device/event", new byte[0], 0, false, null)));
    }
}
