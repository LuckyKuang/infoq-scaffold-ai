package cc.infoq.common.mqtt;

public record MqttProtocolStatus(boolean enabled,
                                 boolean connected,
                                 String lastFailure,
                                 long connectionFailures,
                                 long reconnects,
                                 long subscriptions,
                                 long published,
                                 long publishFailures,
                                 long lastPublishDurationMs,
                                 long totalPublishDurationMs,
                                 long consumed,
                                 long consumeFailures,
                                 long lastConsumeDurationMs,
                                 long totalConsumeDurationMs) {
}
