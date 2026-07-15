package cc.infoq.common.mqtt;

@FunctionalInterface
public interface MqttMessageHandler {

    void handle(MqttInboundMessage message);
}
