package cc.infoq.common.mqtt;

import java.util.Map;

public record MqttPluginStatus(boolean enabled, Map<MqttProtocol, MqttProtocolStatus> protocols) {
}
