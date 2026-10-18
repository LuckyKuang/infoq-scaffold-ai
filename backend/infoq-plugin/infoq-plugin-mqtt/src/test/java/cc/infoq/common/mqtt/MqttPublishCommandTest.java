package cc.infoq.common.mqtt;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

@Tag("dev")
class MqttPublishCommandTest {

    @Test
    void shouldRejectV5PropertiesForV3() {
        assertThrows(IllegalArgumentException.class, () -> new MqttPublishCommand(MqttProtocol.V3_1_1,
            "device/event", new byte[]{1}, 1, false,
            new MqttV5Properties(null, null, null, null, null)));
    }

    @Test
    void shouldDefensivelyCopyPayload() {
        byte[] payload = new byte[]{1, 2};
        MqttPublishCommand command = new MqttPublishCommand(MqttProtocol.V5, "device/event", payload, 1,
            false, null);

        payload[0] = 9;

        assertArrayEquals(new byte[]{1, 2}, command.payload());
    }

    @Test
    void shouldRejectMessageExpiryBeyondMqttV5UnsignedIntRange() {
        assertThrows(IllegalArgumentException.class, () -> new MqttV5Properties(null, null, null,
            MqttV5Properties.MAX_MESSAGE_EXPIRY_INTERVAL_SECONDS + 1, null));
    }

    @Test
    void shouldAcceptMaximumMqttV5MessageExpiry() {
        assertDoesNotThrow(() -> new MqttV5Properties(null, null, null,
            MqttV5Properties.MAX_MESSAGE_EXPIRY_INTERVAL_SECONDS, null));
    }
}
