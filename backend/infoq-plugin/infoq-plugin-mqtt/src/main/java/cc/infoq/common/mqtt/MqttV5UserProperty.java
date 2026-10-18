package cc.infoq.common.mqtt;

import java.util.Objects;

/**
 * MQTT 5 user properties are an ordered list and may contain duplicate keys.
 */
public record MqttV5UserProperty(String key, String value) {

    public MqttV5UserProperty {
        if (key == null || key.isBlank()) {
            throw new IllegalArgumentException("MQTT 5 user property key must not be blank");
        }
        value = Objects.requireNonNull(value, "MQTT 5 user property value must not be null");
    }
}
