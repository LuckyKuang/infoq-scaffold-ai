package cc.infoq.common.mqtt.service;

import cc.infoq.common.mqtt.MqttPluginStatus;
import cc.infoq.common.mqtt.MqttProtocol;
import cc.infoq.common.mqtt.MqttProtocolStatus;
import cc.infoq.common.mqtt.config.MqttProperties;

import java.util.EnumMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;

public class MqttPluginMonitor {

    private final MqttProperties properties;
    private final Map<MqttProtocol, ProtocolMetrics> metrics = new EnumMap<>(MqttProtocol.class);

    public MqttPluginMonitor(MqttProperties properties) {
        this.properties = properties;
        metrics.put(MqttProtocol.V3_1_1, new ProtocolMetrics(properties.getV3().isEnabled()));
        metrics.put(MqttProtocol.V5, new ProtocolMetrics(properties.getV5().isEnabled()));
    }

    public void connected(MqttProtocol protocol, boolean reconnect) {
        ProtocolMetrics protocolMetrics = metrics.get(protocol);
        protocolMetrics.connected.set(true);
        protocolMetrics.lastFailure.set(null);
        if (reconnect) {
            protocolMetrics.reconnects.incrementAndGet();
        }
    }

    public void connectionFailed(MqttProtocol protocol, Throwable failure) {
        ProtocolMetrics protocolMetrics = metrics.get(protocol);
        protocolMetrics.connected.set(false);
        protocolMetrics.connectionFailures.incrementAndGet();
        protocolMetrics.lastFailure.set(failure.getClass().getSimpleName());
    }

    public void disconnected(MqttProtocol protocol, Throwable failure) {
        ProtocolMetrics protocolMetrics = metrics.get(protocol);
        protocolMetrics.connected.set(false);
        if (failure != null) {
            protocolMetrics.lastFailure.set(failure.getClass().getSimpleName());
        }
    }

    public void subscribed(MqttProtocol protocol) {
        metrics.get(protocol).subscriptions.incrementAndGet();
    }

    public void published(MqttProtocol protocol, long durationNanos) {
        ProtocolMetrics protocolMetrics = metrics.get(protocol);
        protocolMetrics.published.incrementAndGet();
        protocolMetrics.recordPublishDuration(durationNanos);
    }

    public void publishFailed(MqttProtocol protocol, Throwable failure, long durationNanos) {
        ProtocolMetrics protocolMetrics = metrics.get(protocol);
        protocolMetrics.publishFailures.incrementAndGet();
        protocolMetrics.recordPublishDuration(durationNanos);
        protocolMetrics.lastFailure.set(failure.getClass().getSimpleName());
    }

    public void consumed(MqttProtocol protocol, long durationNanos) {
        ProtocolMetrics protocolMetrics = metrics.get(protocol);
        protocolMetrics.consumed.incrementAndGet();
        protocolMetrics.recordConsumeDuration(durationNanos);
    }

    public void consumeFailed(MqttProtocol protocol, Throwable failure, long durationNanos) {
        ProtocolMetrics protocolMetrics = metrics.get(protocol);
        protocolMetrics.consumeFailures.incrementAndGet();
        protocolMetrics.recordConsumeDuration(durationNanos);
        protocolMetrics.lastFailure.set(failure.getClass().getSimpleName());
    }

    public MqttPluginStatus status() {
        Map<MqttProtocol, MqttProtocolStatus> statuses = new EnumMap<>(MqttProtocol.class);
        metrics.forEach((protocol, protocolMetrics) -> statuses.put(protocol, protocolMetrics.status()));
        return new MqttPluginStatus(properties.isEnabled(), Map.copyOf(statuses));
    }

    private static class ProtocolMetrics {

        private final boolean enabled;
        private final AtomicReference<Boolean> connected = new AtomicReference<>(false);
        private final AtomicReference<String> lastFailure = new AtomicReference<>();
        private final AtomicLong connectionFailures = new AtomicLong();
        private final AtomicLong reconnects = new AtomicLong();
        private final AtomicLong subscriptions = new AtomicLong();
        private final AtomicLong published = new AtomicLong();
        private final AtomicLong publishFailures = new AtomicLong();
        private final AtomicLong lastPublishDurationMs = new AtomicLong();
        private final AtomicLong totalPublishDurationMs = new AtomicLong();
        private final AtomicLong consumed = new AtomicLong();
        private final AtomicLong consumeFailures = new AtomicLong();
        private final AtomicLong lastConsumeDurationMs = new AtomicLong();
        private final AtomicLong totalConsumeDurationMs = new AtomicLong();

        private ProtocolMetrics(boolean enabled) {
            this.enabled = enabled;
        }

        private MqttProtocolStatus status() {
            return new MqttProtocolStatus(enabled, connected.get(), lastFailure.get(), connectionFailures.get(),
                reconnects.get(), subscriptions.get(), published.get(), publishFailures.get(),
                lastPublishDurationMs.get(), totalPublishDurationMs.get(), consumed.get(), consumeFailures.get(),
                lastConsumeDurationMs.get(), totalConsumeDurationMs.get());
        }

        private void recordPublishDuration(long durationNanos) {
            long durationMs = toMillis(durationNanos);
            lastPublishDurationMs.set(durationMs);
            totalPublishDurationMs.addAndGet(durationMs);
        }

        private void recordConsumeDuration(long durationNanos) {
            long durationMs = toMillis(durationNanos);
            lastConsumeDurationMs.set(durationMs);
            totalConsumeDurationMs.addAndGet(durationMs);
        }

        private static long toMillis(long durationNanos) {
            return TimeUnit.NANOSECONDS.toMillis(Math.max(0, durationNanos));
        }
    }
}
