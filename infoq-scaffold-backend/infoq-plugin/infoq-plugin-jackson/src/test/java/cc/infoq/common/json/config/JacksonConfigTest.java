package cc.infoq.common.json.config;

import cc.infoq.common.json.validate.JsonType;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.Module;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.exc.UnrecognizedPropertyException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.http.converter.json.Jackson2ObjectMapperBuilder;

import java.time.LocalDateTime;
import java.util.TimeZone;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Tag("dev")
class JacksonConfigTest {

    @Test
    @DisplayName("registerJavaTimeModule: should serialize large long as string and support local datetime")
    void registerJavaTimeModuleShouldSerializeAndDeserializeConfiguredTypes() throws Exception {
        JacksonConfig config = new JacksonConfig();
        Module module = config.registerJavaTimeModule();
        ObjectMapper mapper = new ObjectMapper();
        mapper.registerModule(module);

        DemoPayload payload = new DemoPayload();
        payload.setBigId(9007199254740992L);
        payload.setCreatedAt(LocalDateTime.of(2026, 3, 8, 10, 11, 12));

        String json = mapper.writeValueAsString(payload);
        assertTrue(json.contains("\"bigId\":\"9007199254740992\""));
        assertTrue(json.contains("\"createdAt\":\"2026-03-08 10:11:12\""));

        DemoPayload parsed = mapper.readValue(
            "{\"bigId\":1,\"createdAt\":\"2026-03-08 10:11:12\"}",
            DemoPayload.class
        );
        assertEquals(LocalDateTime.of(2026, 3, 8, 10, 11, 12), parsed.getCreatedAt());
    }

    @Test
    @DisplayName("customizer: should set default timezone")
    void customizerShouldSetDefaultTimeZone() {
        JacksonConfig config = new JacksonConfig();
        Jackson2ObjectMapperBuilder builder = config.jackson2ObjectMapperBuilder();
        ObjectMapper mapper = builder.build();

        assertEquals(TimeZone.getDefault(), mapper.getSerializationConfig().getTimeZone());
        assertTrue(mapper.getDeserializationConfig().isEnabled(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES));
        assertThrows(UnrecognizedPropertyException.class,
            () -> mapper.readValue("{\"bigId\":1,\"extra\":true}", DemoPayload.class));
    }

    @Test
    @DisplayName("objectMapper: should expose jackson2 mapper for Spring Boot 4 security startup")
    void objectMapperShouldExposeJackson2Bean() throws Exception {
        JacksonConfig config = new JacksonConfig();
        ObjectMapper mapper = config.objectMapper(config.jackson2ObjectMapperBuilder(), config.registerJavaTimeModule());

        DemoPayload payload = new DemoPayload();
        payload.setBigId(9007199254740992L);
        payload.setCreatedAt(LocalDateTime.of(2026, 3, 8, 10, 11, 12));

        String json = mapper.writeValueAsString(payload);
        assertTrue(json.contains("\"bigId\":\"9007199254740992\""));
        assertEquals(TimeZone.getDefault(), mapper.getSerializationConfig().getTimeZone());
        assertThrows(UnrecognizedPropertyException.class,
            () -> mapper.readValue("{\"bigId\":1,\"extra\":true}", DemoPayload.class));
    }

    @Test
    @DisplayName("JsonType enum: should expose all constants")
    void jsonTypeEnumShouldExposeAllConstants() {
        assertEquals(3, JsonType.values().length);
        assertEquals(JsonType.OBJECT, JsonType.valueOf("OBJECT"));
        assertEquals(JsonType.ARRAY, JsonType.valueOf("ARRAY"));
        assertEquals(JsonType.ANY, JsonType.valueOf("ANY"));
    }

    public static class DemoPayload {
        private Long bigId;
        private LocalDateTime createdAt;

        public Long getBigId() {
            return bigId;
        }

        public void setBigId(Long bigId) {
            this.bigId = bigId;
        }

        public LocalDateTime getCreatedAt() {
            return createdAt;
        }

        public void setCreatedAt(LocalDateTime createdAt) {
            this.createdAt = createdAt;
        }
    }
}
