package cc.infoq.common.mqtt.service;

import cc.infoq.common.mqtt.MqttProtocol;
import cc.infoq.common.mqtt.MqttProtocolStatus;
import cc.infoq.common.mqtt.config.MqttProperties;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.junit.jupiter.api.Assertions.assertEquals;

@Tag("dev")
class MqttPluginMonitorTest {

    @Test
    void shouldRecordPublishAndConsumeDurationsWithoutMessageContents() {
        MqttProperties properties = new MqttProperties();
        properties.setEnabled(true);
        properties.getV3().setEnabled(true);
        MqttPluginMonitor monitor = new MqttPluginMonitor(properties);

        monitor.published(MqttProtocol.V3_1_1, Duration.ofMillis(7).toNanos());
        monitor.publishFailed(MqttProtocol.V3_1_1, new IllegalStateException(), Duration.ofMillis(3).toNanos());
        monitor.consumed(MqttProtocol.V3_1_1, Duration.ofMillis(5).toNanos());
        monitor.consumeFailed(MqttProtocol.V3_1_1, new IllegalArgumentException(), Duration.ofMillis(2).toNanos());

        MqttProtocolStatus status = monitor.status().protocols().get(MqttProtocol.V3_1_1);

        assertEquals(1, status.published());
        assertEquals(1, status.publishFailures());
        assertEquals(3, status.lastPublishDurationMs());
        assertEquals(10, status.totalPublishDurationMs());
        assertEquals(1, status.consumed());
        assertEquals(1, status.consumeFailures());
        assertEquals(2, status.lastConsumeDurationMs());
        assertEquals(7, status.totalConsumeDurationMs());
        assertEquals("IllegalArgumentException", status.lastFailure());
    }
}
