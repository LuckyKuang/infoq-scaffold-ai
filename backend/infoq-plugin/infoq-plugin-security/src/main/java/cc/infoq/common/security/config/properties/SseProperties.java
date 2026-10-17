package cc.infoq.common.security.config.properties;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * sse 配置属性
 * @author Pontus
 */
@Data
@ConfigurationProperties(prefix = "sse")
public class SseProperties {
    /**
     * 路径
     */
    private String path;
}
