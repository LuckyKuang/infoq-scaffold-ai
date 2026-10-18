package cc.infoq.common.push.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties("infoq.push")
public class PushProperties {

    private boolean enabled;
    private boolean websocketEnabled;
    private boolean sseEnabled;
}
