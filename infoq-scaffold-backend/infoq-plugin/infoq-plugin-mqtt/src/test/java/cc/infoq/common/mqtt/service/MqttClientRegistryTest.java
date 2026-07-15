package cc.infoq.common.mqtt.service;

import cc.infoq.common.mqtt.MqttProtocol;
import cc.infoq.common.mqtt.MqttPublishCommand;
import cc.infoq.common.mqtt.MqttUnavailableException;
import cc.infoq.common.mqtt.config.MqttProperties;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@Tag("dev")
class MqttClientRegistryTest {

    @Test
    void shouldRouteEachPublishToItsExplicitProtocolClient() {
        MqttProperties properties = enabledProtocols();
        RecordingClient v3Client = new RecordingClient();
        RecordingClient v5Client = new RecordingClient();
        MqttClientRegistry registry = new MqttClientRegistry(properties, new MqttPluginMonitor(properties), Map.of(
            MqttProtocol.V3_1_1, v3Client,
            MqttProtocol.V5, v5Client));
        MqttPublishCommand v3Command = command(MqttProtocol.V3_1_1);
        MqttPublishCommand v5Command = command(MqttProtocol.V5);

        registry.publish(v3Command);
        registry.publish(v5Command);

        assertSame(v3Command, v3Client.publishedCommand);
        assertSame(v5Command, v5Client.publishedCommand);
    }

    @Test
    void shouldRejectDisabledProtocolWithoutFallingBackToAnotherClient() {
        MqttProperties properties = enabledProtocols();
        properties.getV3().setEnabled(false);
        RecordingClient v5Client = new RecordingClient();
        MqttClientRegistry registry = new MqttClientRegistry(properties, new MqttPluginMonitor(properties),
            Map.of(MqttProtocol.V5, v5Client));

        assertThrows(MqttUnavailableException.class, () -> registry.publish(command(MqttProtocol.V3_1_1)));

        assertNull(v5Client.publishedCommand);
    }

    @Test
    void shouldRejectUnavailableProtocolWithoutFallingBackToAnotherClient() {
        MqttProperties properties = enabledProtocols();
        RecordingClient v3Client = new RecordingClient(false);
        RecordingClient v5Client = new RecordingClient();
        MqttClientRegistry registry = new MqttClientRegistry(properties, new MqttPluginMonitor(properties), Map.of(
            MqttProtocol.V3_1_1, v3Client,
            MqttProtocol.V5, v5Client));

        assertThrows(MqttUnavailableException.class, () -> registry.publish(command(MqttProtocol.V3_1_1)));

        assertNull(v5Client.publishedCommand);
    }

    @Test
    void shouldCloseAndRejectOptionalProtocolAfterSubscriptionFailure() {
        MqttProperties properties = enabledProtocols();
        RecordingClient v3Client = new RecordingClient(true, new IllegalStateException("subscription denied"));
        RecordingClient v5Client = new RecordingClient();
        MqttClientRegistry registry = new MqttClientRegistry(properties, new MqttPluginMonitor(properties), Map.of(
            MqttProtocol.V3_1_1, v3Client,
            MqttProtocol.V5, v5Client));

        assertTrue(v3Client.closed);
        assertThrows(MqttUnavailableException.class, () -> registry.publish(command(MqttProtocol.V3_1_1)));

        registry.publish(command(MqttProtocol.V5));
        assertSame(command(MqttProtocol.V5).protocol(), v5Client.publishedCommand.protocol());
    }

    @Test
    void shouldCloseAllClientsBeforeFailingRequiredInitialization() {
        MqttProperties properties = enabledProtocols();
        properties.setRequired(true);
        RecordingClient v3Client = new RecordingClient();
        RecordingClient v5Client = new RecordingClient(true, new IllegalStateException("subscription denied"));

        assertThrows(MqttUnavailableException.class, () -> new MqttClientRegistry(properties,
            new MqttPluginMonitor(properties), Map.of(MqttProtocol.V3_1_1, v3Client, MqttProtocol.V5, v5Client)));

        assertTrue(v3Client.closed);
        assertTrue(v5Client.closed);
    }

    private static MqttProperties enabledProtocols() {
        MqttProperties properties = new MqttProperties();
        properties.setEnabled(true);
        properties.getV3().setEnabled(true);
        properties.getV5().setEnabled(true);
        return properties;
    }

    private static MqttPublishCommand command(MqttProtocol protocol) {
        return new MqttPublishCommand(protocol, "device/event", new byte[0], 0, false, null);
    }

    private static class RecordingClient implements MqttProtocolClient {

        private final boolean connected;
        private final RuntimeException connectFailure;
        private MqttPublishCommand publishedCommand;
        private boolean closed;

        private RecordingClient() {
            this(true);
        }

        private RecordingClient(boolean connected) {
            this(connected, null);
        }

        private RecordingClient(boolean connected, RuntimeException connectFailure) {
            this.connected = connected;
            this.connectFailure = connectFailure;
        }

        @Override
        public void connect() {
            if (connectFailure != null) {
                throw connectFailure;
            }
        }

        @Override
        public boolean isConnected() {
            return connected;
        }

        @Override
        public void publish(MqttPublishCommand command) {
            publishedCommand = command;
        }

        @Override
        public void close() {
            closed = true;
        }
    }
}
