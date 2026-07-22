package cc.infoq.common.mqtt.config;

import cc.infoq.common.mqtt.MqttProtocol;

import java.net.URI;
import java.time.Duration;
import java.util.Locale;

final class MqttPropertiesValidator {

    private MqttPropertiesValidator() {
    }

    static void validate(MqttProperties properties) {
        if (!properties.isEnabled()) {
            return;
        }
        MqttProperties.ProtocolProperties v3 = properties.getV3();
        MqttProperties.ProtocolProperties v5 = properties.getV5();
        if (v3 == null || v5 == null) {
            throw new IllegalStateException("MQTT v3 and v5 configuration must not be null");
        }
        if (!v3.isEnabled() && !v5.isEnabled()) {
            throw new IllegalStateException("infoq.mqtt.enabled=true requires v3 or v5 to be enabled");
        }
        validateProtocol(MqttProtocol.V3_1_1, v3);
        validateProtocol(MqttProtocol.V5, v5);
        if (v3.isEnabled() && v5.isEnabled() && v3.getClientId().equals(v5.getClientId())) {
            throw new IllegalStateException("MQTT v3 and v5 client IDs must be different");
        }
    }

    private static void validateProtocol(MqttProtocol protocol, MqttProperties.ProtocolProperties properties) {
        if (!properties.isEnabled()) {
            return;
        }
        if (properties.getUri() == null || properties.getUri().isBlank()) {
            throw new IllegalStateException("MQTT " + protocol + " URI must not be blank");
        }
        if (properties.getClientId() == null || properties.getClientId().isBlank()) {
            throw new IllegalStateException("MQTT " + protocol + " client ID must not be blank");
        }
        if (properties.getQos() < 0 || properties.getQos() > 2) {
            throw new IllegalStateException("MQTT " + protocol + " QoS must be between 0 and 2");
        }
        validateConnectTimeout(protocol, properties.getConnectTimeout());
        validateCompletionTimeout(protocol, properties.getCompletionTimeout());
        URI uri = validateUri(protocol, properties);
        validateTlsScheme(protocol, properties.isTlsEnabled(), uri.getScheme());
        if (properties.getSubscriptions() == null) {
            throw new IllegalStateException("MQTT " + protocol + " subscriptions must not be null");
        }
        if (properties.getSubscriptions().stream().anyMatch(topic -> topic == null || topic.isBlank())) {
            throw new IllegalStateException("MQTT " + protocol + " subscriptions must not contain blank topics");
        }
    }

    private static void validateConnectTimeout(MqttProtocol protocol, Duration timeout) {
        if (timeout == null || timeout.isNegative() || timeout.isZero()) {
            throw new IllegalStateException("MQTT " + protocol + " connect timeout must be positive");
        }
        long seconds = timeout.getSeconds();
        if (seconds < 1 || seconds > Integer.MAX_VALUE) {
            throw new IllegalStateException("MQTT " + protocol
                + " connect timeout must be between 1 second and " + Integer.MAX_VALUE + " seconds");
        }
    }

    private static void validateCompletionTimeout(MqttProtocol protocol, Duration timeout) {
        if (timeout == null || timeout.isNegative() || timeout.isZero()) {
            throw new IllegalStateException("MQTT " + protocol + " completion timeout must be positive");
        }
        try {
            if (timeout.toMillis() < 1) {
                throw new IllegalStateException("MQTT " + protocol + " completion timeout must be at least 1 millisecond");
            }
        } catch (ArithmeticException ex) {
            throw new IllegalStateException("MQTT " + protocol + " completion timeout is too large", ex);
        }
    }

    private static URI validateUri(MqttProtocol protocol, MqttProperties.ProtocolProperties properties) {
        URI uri;
        try {
            uri = URI.create(properties.getUri());
        } catch (IllegalArgumentException ex) {
            throw new IllegalStateException("MQTT " + protocol + " URI is invalid", ex);
        }
        if (uri.getScheme() == null || uri.getHost() == null || uri.getHost().isBlank()) {
            throw new IllegalStateException("MQTT " + protocol + " URI must include scheme and host");
        }
        if (uri.getUserInfo() != null || uri.getQuery() != null || uri.getFragment() != null) {
            throw new IllegalStateException("MQTT " + protocol + " URI must not include credentials, query, or fragment");
        }
        return uri;
    }

    private static void validateTlsScheme(MqttProtocol protocol, boolean tlsEnabled, String scheme) {
        String normalizedScheme = scheme.toLowerCase(Locale.ROOT);
        if (protocol == MqttProtocol.V5) {
            if (tlsEnabled && !"ssl".equals(normalizedScheme)) {
                throw new IllegalStateException("MQTT V5 TLS requires an ssl URI");
            }
            if (!tlsEnabled && !"tcp".equals(normalizedScheme)) {
                throw new IllegalStateException("MQTT V5 without TLS requires a tcp URI");
            }
            return;
        }
        if (tlsEnabled && !"ssl".equals(normalizedScheme) && !"wss".equals(normalizedScheme)) {
            throw new IllegalStateException("MQTT V3_1_1 TLS requires an ssl or wss URI");
        }
        if (!tlsEnabled && !"tcp".equals(normalizedScheme) && !"ws".equals(normalizedScheme)) {
            throw new IllegalStateException("MQTT V3_1_1 without TLS requires a tcp or ws URI");
        }
    }
}
