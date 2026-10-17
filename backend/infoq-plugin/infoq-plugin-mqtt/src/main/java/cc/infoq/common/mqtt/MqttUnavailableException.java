package cc.infoq.common.mqtt;

public class MqttUnavailableException extends IllegalStateException {

    public MqttUnavailableException(String message) {
        super(message);
    }

    public MqttUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
