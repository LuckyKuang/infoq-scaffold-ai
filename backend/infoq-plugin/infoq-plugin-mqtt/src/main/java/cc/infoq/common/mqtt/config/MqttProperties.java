package cc.infoq.common.mqtt.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

@Data
@ConfigurationProperties("infoq.mqtt")
public class MqttProperties {

    private boolean enabled;
    private boolean required;
    private ProtocolProperties v3 = new ProtocolProperties();
    private ProtocolProperties v5 = new ProtocolProperties();

    @Data
    public static class ProtocolProperties {

        private boolean enabled;
        private String uri;
        private String clientId;
        private String username;
        private String password;
        private boolean tlsEnabled;
        private int qos = 1;
        private boolean automaticReconnect = true;
        private Duration connectTimeout = Duration.ofSeconds(10);
        private Duration completionTimeout = Duration.ofSeconds(10);
        private List<String> subscriptions = new ArrayList<>();
    }
}
