package cc.infoq.common.mqtt;

import java.util.List;

public record MqttV5Properties(String responseTopic,
                               byte[] correlationData,
                               String contentType,
                               Long messageExpiryIntervalSeconds,
                               List<MqttV5UserProperty> userProperties) {

    public static final long MAX_MESSAGE_EXPIRY_INTERVAL_SECONDS = 4_294_967_295L;

    public MqttV5Properties {
        correlationData = correlationData == null ? null : correlationData.clone();
        userProperties = userProperties == null ? List.of() : List.copyOf(userProperties);
        if (messageExpiryIntervalSeconds != null
            && (messageExpiryIntervalSeconds < 0
            || messageExpiryIntervalSeconds > MAX_MESSAGE_EXPIRY_INTERVAL_SECONDS)) {
            throw new IllegalArgumentException("messageExpiryIntervalSeconds must be between 0 and "
                + MAX_MESSAGE_EXPIRY_INTERVAL_SECONDS);
        }
    }

    @Override
    public byte[] correlationData() {
        return correlationData == null ? null : correlationData.clone();
    }
}
