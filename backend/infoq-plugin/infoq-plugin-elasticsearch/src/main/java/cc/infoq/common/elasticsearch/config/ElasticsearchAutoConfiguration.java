package cc.infoq.common.elasticsearch.config;

import cc.infoq.common.elasticsearch.ElasticsearchOperations;
import cc.infoq.common.elasticsearch.ElasticsearchUnavailableException;
import cc.infoq.common.elasticsearch.service.ElasticsearchPluginMonitor;
import cc.infoq.common.elasticsearch.service.UnavailableElasticsearchOperations;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;

@AutoConfiguration
@ConditionalOnProperty(prefix = "infoq.elasticsearch", name = "enabled", havingValue = "true")
@EnableConfigurationProperties(ElasticsearchProperties.class)
public class ElasticsearchAutoConfiguration {

    private static final Logger log = LoggerFactory.getLogger(ElasticsearchAutoConfiguration.class);

    @Bean
    @ConditionalOnMissingBean
    ElasticsearchClientCreator elasticsearchClientCreator() {
        return ElasticsearchClientFactory::create;
    }

    @Bean(destroyMethod = "close")
    public ElasticsearchOperations elasticsearchOperations(ElasticsearchProperties properties,
                                                            ElasticsearchClientCreator clientCreator) {
        ElasticsearchPropertiesValidator.validate(properties);
        ElasticsearchPluginMonitor monitor = new ElasticsearchPluginMonitor();
        ElasticsearchClientResources resources = null;
        try {
            resources = clientCreator.create(properties);
            DefaultElasticsearchOperations operations = new DefaultElasticsearchOperations(resources, monitor);
            operations.verifyConnection();
            return operations;
        } catch (ElasticsearchUnavailableException ex) {
            closeResources(resources);
            return unavailableOrFail(properties, monitor, ex);
        } catch (RuntimeException ex) {
            monitor.connectionFailed(ex);
            closeResources(resources);
            return unavailableOrFail(properties, monitor, ex);
        }
    }

    private ElasticsearchOperations unavailableOrFail(ElasticsearchProperties properties,
                                                       ElasticsearchPluginMonitor monitor,
                                                       RuntimeException failure) {
        if (properties.isRequired()) {
            throw new ElasticsearchUnavailableException("Elasticsearch client initialization failed", failure);
        }
        log.warn("Elasticsearch client initialization unavailable: {}", failure.getClass().getSimpleName());
        return new UnavailableElasticsearchOperations(monitor);
    }

    private void closeResources(ElasticsearchClientResources resources) {
        if (resources == null) {
            return;
        }
        try {
            resources.close();
        } catch (RuntimeException ex) {
            log.warn("Elasticsearch client resource close failed: {}", ex.getClass().getSimpleName());
        }
    }
}
