package cc.infoq.common.mqtt.service;

import cc.infoq.common.mqtt.MqttProtocol;
import cc.infoq.common.mqtt.MqttProtocolStatus;
import cc.infoq.common.mqtt.MqttPublishCommand;
import cc.infoq.common.mqtt.config.MqttProperties;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

@Tag("dev")
class MqttReconnectFailureHandlerTest {

    @Test
    void shouldCloseClientAndRecordFailureWhenReconnectSubscriptionFails() {
        MqttProperties properties = new MqttProperties();
        properties.setEnabled(true);
        properties.getV5().setEnabled(true);
        MqttPluginMonitor monitor = new MqttPluginMonitor(properties);
        CloseTrackingClient client = new CloseTrackingClient();

        MqttReconnectFailureHandler.closeUnavailableClient(MqttProtocol.V5, client, monitor,
            new IllegalStateException("subscription denied"));

        MqttProtocolStatus status = monitor.status().protocols().get(MqttProtocol.V5);
        assertTrue(client.closed);
        assertFalse(status.connected());
        assertEquals(1, status.connectionFailures());
        assertEquals("IllegalStateException", status.lastFailure());
    }

    private static final class CloseTrackingClient implements MqttProtocolClient {

        private boolean closed;

        @Override
        public void connect() {
        }

        @Override
        public boolean isConnected() {
            return !closed;
        }

        @Override
        public void publish(MqttPublishCommand command) {
        }

        @Override
        public void close() {
            closed = true;
        }
    }
}
