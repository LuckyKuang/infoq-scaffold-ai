package cc.infoq.common.mqtt.service;

import cc.infoq.common.mqtt.MqttV5Properties;
import cc.infoq.common.mqtt.MqttV5UserProperty;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

@Tag("dev")
class PahoV5MqttClientTest {

    @Test
    void shouldPreserveDuplicateUserPropertiesDuringPahoRoundTrip() {
        MqttV5Properties source = new MqttV5Properties(null, null, null, null, List.of(
            new MqttV5UserProperty("trace", "first"),
            new MqttV5UserProperty("trace", "second")));

        MqttV5Properties restored = PahoV5MqttClient.fromPahoProperties(
            PahoV5MqttClient.toPahoProperties(source));

        assertEquals(source.userProperties(), restored.userProperties());
    }
}
