package cc.infoq.common.elasticsearch.config;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

@Tag("dev")
class ElasticsearchPropertiesValidatorTest {

    @Test
    void shouldRejectSubMillisecondTimeout() {
        ElasticsearchProperties properties = validProperties();
        properties.setConnectTimeout(Duration.ofNanos(999_999));

        assertThrows(IllegalStateException.class, () -> ElasticsearchPropertiesValidator.validate(properties));
    }

    @Test
    void shouldRejectTimeoutBeyondHttpClientIntegerMilliseconds() {
        ElasticsearchProperties properties = validProperties();
        properties.setRequestTimeout(Duration.ofMillis(Integer.MAX_VALUE).plusMillis(1));

        assertThrows(IllegalStateException.class, () -> ElasticsearchPropertiesValidator.validate(properties));
    }

    @Test
    void shouldAcceptTimeoutWithinHttpClientIntegerMilliseconds() {
        assertDoesNotThrow(() -> ElasticsearchPropertiesValidator.validate(validProperties()));
    }

    private static ElasticsearchProperties validProperties() {
        ElasticsearchProperties properties = new ElasticsearchProperties();
        properties.setEnabled(true);
        properties.setTlsEnabled(false);
        properties.setUris(List.of("http://localhost:9200"));
        return properties;
    }
}
