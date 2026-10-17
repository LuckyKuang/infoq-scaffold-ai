package cc.infoq.common.mqtt;

public interface MqttPublisher {

    void publish(MqttPublishCommand command);
}
