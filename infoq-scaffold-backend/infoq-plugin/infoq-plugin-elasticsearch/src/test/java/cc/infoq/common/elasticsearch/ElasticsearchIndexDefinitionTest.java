package cc.infoq.common.elasticsearch;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@Tag("dev")
class ElasticsearchIndexDefinitionTest {

    @Test
    @SuppressWarnings({"rawtypes", "unchecked"})
    void shouldDeeplyFreezeJsonCompatibleSettingsAndMappings() {
        Map<String, Object> settings = new LinkedHashMap<>();
        settings.put("number_of_shards", "1");
        Map<String, Object> title = new LinkedHashMap<>();
        title.put("type", "text");
        Map<String, Object> properties = new LinkedHashMap<>();
        properties.put("title", title);
        Map<String, Object> mappings = new LinkedHashMap<>();
        mappings.put("properties", properties);
        mappings.put("dynamic_date_formats", List.of("strict_date_optional_time"));
        mappings.put("meta", null);

        ElasticsearchIndexDefinition definition = new ElasticsearchIndexDefinition("system-message-v1", settings, mappings);

        title.put("type", "keyword");
        properties.clear();
        settings.put("number_of_replicas", "0");

        Map<?, ?> storedProperties = (Map<?, ?>) definition.mappings().get("properties");
        Map<?, ?> storedTitle = (Map<?, ?>) storedProperties.get("title");
        assertEquals("text", storedTitle.get("type"));
        assertEquals("1", definition.settings().get("number_of_shards"));
        assertNull(definition.mappings().get("meta"));
        assertThrows(UnsupportedOperationException.class, () -> definition.settings().put("refresh_interval", "1s"));
        assertThrows(UnsupportedOperationException.class, () -> ((Map) storedProperties).put("body", Map.of("type", "text")));
    }

    @Test
    @SuppressWarnings({"rawtypes", "unchecked"})
    void shouldRejectInvalidDefinitionValues() {
        Map invalidKey = new LinkedHashMap();
        invalidKey.put(1, "value");

        assertAll(
            () -> assertThrows(IllegalArgumentException.class,
                () -> new ElasticsearchIndexDefinition(" ", Map.of(), Map.of())),
            () -> assertThrows(NullPointerException.class,
                () -> new ElasticsearchIndexDefinition("system-message", null, Map.of())),
            () -> assertThrows(IllegalArgumentException.class,
                () -> new ElasticsearchIndexDefinition("system-message", invalidKey, Map.of())),
            () -> assertThrows(IllegalArgumentException.class,
                () -> new ElasticsearchIndexDefinition("system-message", Map.of("refresh", Double.NaN), Map.of())),
            () -> assertThrows(IllegalArgumentException.class,
                () -> new ElasticsearchIndexDefinition("system-message", Map.of(),
                    Map.of("properties", Map.of("title", new Object()))))
        );
    }
}
