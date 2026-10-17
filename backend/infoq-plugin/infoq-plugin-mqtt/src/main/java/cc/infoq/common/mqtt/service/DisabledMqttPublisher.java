package cc.infoq.common.mqtt.service;

import cc.infoq.common.mqtt.MqttPublishCommand;
import cc.infoq.common.mqtt.MqttPublisher;
import cc.infoq.common.mqtt.MqttUnavailableException;

public class DisabledMqttPublisher implements MqttPublisher {

    @Override
    public void publish(MqttPublishCommand command) {
        throw new MqttUnavailableException("MQTT plugin is disabled");
    }
}
