package cc.infoq.common.mqtt;

import java.util.Objects;

public record MqttPublishCommand(MqttProtocol protocol,
                                 String topic,
                                 byte[] payload,
                                 int qos,
                                 boolean retained,
                                 MqttV5Properties v5Properties) {

    public MqttPublishCommand {
        protocol = Objects.requireNonNull(protocol, "protocol must not be null");
        if (topic == null || topic.isBlank()) {
            throw new IllegalArgumentException("topic must not be blank");
        }
        payload = Objects.requireNonNull(payload, "payload must not be null").clone();
        if (qos < 0 || qos > 2) {
            throw new IllegalArgumentException("qos must be between 0 and 2");
        }
        if (protocol != MqttProtocol.V5 && v5Properties != null) {
            throw new IllegalArgumentException("MQTT 5 properties require protocol V5");
        }
    }

    @Override
    public byte[] payload() {
        return payload.clone();
    }
}
