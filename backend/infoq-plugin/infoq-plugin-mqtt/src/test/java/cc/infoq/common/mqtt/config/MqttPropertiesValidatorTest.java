package cc.infoq.common.mqtt.config;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

@Tag("dev")
class MqttPropertiesValidatorTest {

    @Test
    void shouldRejectConnectTimeoutBelowOneSecond() {
        MqttProperties properties = validV3Properties();
        properties.getV3().setConnectTimeout(Duration.ofMillis(999));

        assertThrows(IllegalStateException.class, () -> MqttPropertiesValidator.validate(properties));
    }

    @Test
    void shouldRejectCompletionTimeoutBelowOneMillisecond() {
        MqttProperties properties = validV3Properties();
        properties.getV3().setCompletionTimeout(Duration.ofNanos(999_999));

        assertThrows(IllegalStateException.class, () -> MqttPropertiesValidator.validate(properties));
    }

    @Test
    void shouldRejectBlankSubscription() {
        MqttProperties properties = validV3Properties();
        properties.getV3().setSubscriptions(List.of("device/events", " "));

        assertThrows(IllegalStateException.class, () -> MqttPropertiesValidator.validate(properties));
    }

    @Test
    void shouldRejectTlsUriWhenTlsIsDisabled() {
        MqttProperties properties = validV3Properties();
        properties.getV3().setUri("ssl://localhost:8883");

        assertThrows(IllegalStateException.class, () -> MqttPropertiesValidator.validate(properties));
    }

    @Test
    void shouldRejectUriWithCredentialsOrQuery() {
        MqttProperties properties = validV3Properties();
        properties.getV3().setUri("tcp://user:password@localhost:1883?trace=true");

        assertThrows(IllegalStateException.class, () -> MqttPropertiesValidator.validate(properties));
    }

    @Test
    void shouldRejectWebSocketUriForMqttV5() {
        MqttProperties properties = validV3Properties();
        properties.getV3().setEnabled(false);
        properties.getV5().setEnabled(true);
        properties.getV5().setUri("ws://localhost:80/mqtt");
        properties.getV5().setClientId("mqtt-v5-test");

        assertThrows(IllegalStateException.class, () -> MqttPropertiesValidator.validate(properties));
    }

    @Test
    void shouldAcceptSecondPrecisionTimeoutAndNonBlankSubscriptions() {
        MqttProperties properties = validV3Properties();
        properties.getV3().setSubscriptions(List.of("device/events"));

        assertDoesNotThrow(() -> MqttPropertiesValidator.validate(properties));
    }

    private static MqttProperties validV3Properties() {
        MqttProperties properties = new MqttProperties();
        properties.setEnabled(true);
        properties.getV3().setEnabled(true);
        properties.getV3().setUri("tcp://localhost:1883");
        properties.getV3().setClientId("mqtt-v3-test");
        return properties;
    }
}
