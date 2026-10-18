package cc.infoq.common.mqtt.service;

import cc.infoq.common.mqtt.MqttInboundMessage;
import cc.infoq.common.mqtt.MqttMessageHandler;
import cc.infoq.common.mqtt.MqttProtocol;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;

final class MqttInboundMessageDispatcher {

    private static final Logger log = LoggerFactory.getLogger(MqttInboundMessageDispatcher.class);

    private MqttInboundMessageDispatcher() {
    }

    static void dispatch(MqttProtocol protocol,
                         MqttInboundMessage message,
                         List<MqttMessageHandler> handlers,
                         MqttPluginMonitor monitor) {
        for (MqttMessageHandler handler : handlers) {
            long startedAt = System.nanoTime();
            try {
                handler.handle(message);
                monitor.consumed(protocol, System.nanoTime() - startedAt);
            } catch (RuntimeException ex) {
                monitor.consumeFailed(protocol, ex, System.nanoTime() - startedAt);
                log.warn("MQTT inbound handler failed: protocol={}, topicHash={}, failure={}", protocol,
                    topicHash(message.topic()), ex.getClass().getSimpleName());
                throw ex;
            }
        }
    }

    private static String topicHash(String topic) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(topic.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest, 0, 8);
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is unavailable", ex);
        }
    }
}
