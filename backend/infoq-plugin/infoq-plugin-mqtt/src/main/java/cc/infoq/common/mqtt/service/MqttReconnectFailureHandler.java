package cc.infoq.common.mqtt.service;

import cc.infoq.common.mqtt.MqttProtocol;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

final class MqttReconnectFailureHandler {

    private static final Logger log = LoggerFactory.getLogger(MqttReconnectFailureHandler.class);

    private MqttReconnectFailureHandler() {
    }

    static void closeUnavailableClient(MqttProtocol protocol,
                                       MqttProtocolClient client,
                                       MqttPluginMonitor monitor,
                                       Throwable failure) {
        monitor.connectionFailed(protocol, failure);
        try {
            client.close();
        } catch (Exception closeFailure) {
            log.warn("MQTT {} close after reconnect subscription failure: {}", protocol,
                closeFailure.getClass().getSimpleName());
        }
    }
}
