package cc.infoq.common.elasticsearch.config;

import cc.infoq.common.elasticsearch.ElasticsearchOperations;
import cc.infoq.common.elasticsearch.ElasticsearchStatusProvider;
import cc.infoq.common.elasticsearch.ElasticsearchUnavailableException;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import static org.junit.jupiter.api.Assertions.*;

@Tag("dev")
class ElasticsearchAutoConfigurationTest {

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
        .withConfiguration(AutoConfigurations.of(ElasticsearchAutoConfiguration.class));

    @Test
    void shouldNotCreateClientWhenPluginIsDisabled() {
        contextRunner.run(context -> {
            assertFalse(context.containsBean("elasticsearchOperations"));
            assertTrue(context.getBeansOfType(ElasticsearchStatusProvider.class).isEmpty());
        });
    }

    @Test
    void shouldRejectEnabledPluginWithoutUri() {
        contextRunner.withPropertyValues("infoq.elasticsearch.enabled=true").run(context ->
            assertNotNull(context.getStartupFailure()));
    }

    @Test
    void shouldKeepApplicationRunningWhenOptionalClientCreationFails() {
        contextRunner
            .withBean(ElasticsearchClientCreator.class, () -> properties -> {
                throw new IllegalStateException("controlled failure");
            })
            .withPropertyValues("infoq.elasticsearch.enabled=true", "infoq.elasticsearch.uris=https://localhost:9200")
            .run(context -> {
                assertNull(context.getStartupFailure());
                ElasticsearchOperations operations = context.getBean(ElasticsearchOperations.class);

                assertFalse(operations.status().available());
                assertEquals(1, operations.status().connectionFailures());
            });
    }

    @Test
    void shouldFailStartupWhenRequiredClientCreationFails() {
        contextRunner
            .withBean(ElasticsearchClientCreator.class, () -> properties -> {
                throw new IllegalStateException("controlled failure");
            })
            .withPropertyValues(
                "infoq.elasticsearch.enabled=true",
                "infoq.elasticsearch.required=true",
                "infoq.elasticsearch.uris=https://localhost:9200")
            .run(context -> {
                assertNotNull(context.getStartupFailure());
                assertNotNull(findCause(context.getStartupFailure(), ElasticsearchUnavailableException.class));
            });
    }

    private static <T extends Throwable> T findCause(Throwable throwable, Class<T> type) {
        Throwable current = throwable;
        while (current != null) {
            if (type.isInstance(current)) {
                return type.cast(current);
            }
            current = current.getCause();
        }
        return null;
    }
}
