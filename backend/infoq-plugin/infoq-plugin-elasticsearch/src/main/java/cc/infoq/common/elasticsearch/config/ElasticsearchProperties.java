package cc.infoq.common.elasticsearch.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

@Data
@ConfigurationProperties("infoq.elasticsearch")
public class ElasticsearchProperties {

    private boolean enabled;
    private boolean required;
    private List<String> uris = new ArrayList<>();
    private String username;
    private String password;
    private boolean tlsEnabled = true;
    private Duration connectTimeout = Duration.ofSeconds(5);
    private Duration requestTimeout = Duration.ofSeconds(10);
}
