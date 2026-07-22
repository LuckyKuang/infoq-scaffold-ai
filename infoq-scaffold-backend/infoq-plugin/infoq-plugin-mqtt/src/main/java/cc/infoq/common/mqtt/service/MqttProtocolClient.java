package cc.infoq.common.mqtt.service;

import cc.infoq.common.mqtt.MqttPublishCommand;

interface MqttProtocolClient extends AutoCloseable {

    void connect() throws Exception;

    boolean isConnected();

    void publish(MqttPublishCommand command) throws Exception;
}
