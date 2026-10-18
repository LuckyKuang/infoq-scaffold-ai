package cc.infoq.common.sse.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * SSE 配置项
 *
 * @author Pontus
 */
@Data
@ConfigurationProperties("sse")
public class SseProperties {

    /**
     * 是否开启
     */
    private Boolean enabled;

    /**
     * 路径
     */
    private String path;
}
