package cc.infoq.common.mqtt.service;

import cc.infoq.common.mqtt.MqttInboundMessage;
import cc.infoq.common.mqtt.MqttProtocol;
import cc.infoq.common.mqtt.config.MqttProperties;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

@Tag("dev")
class MqttInboundMessageDispatcherTest {

    @Test
    void shouldRecordAndPropagateHandlerFailure() {
        MqttProperties properties = new MqttProperties();
        properties.setEnabled(true);
        properties.getV5().setEnabled(true);
        MqttPluginMonitor monitor = new MqttPluginMonitor(properties);
        MqttInboundMessage message = new MqttInboundMessage(MqttProtocol.V5, "device/event", new byte[0], 1,
            false, false, Instant.now(), null);

        assertThrows(IllegalStateException.class, () -> MqttInboundMessageDispatcher.dispatch(MqttProtocol.V5,
            message, List.of(inbound -> {
                throw new IllegalStateException("handler failure");
            }), monitor));

        assertEquals(1, monitor.status().protocols().get(MqttProtocol.V5).consumeFailures());
    }
}
