package cc.infoq.common.translation.core.handler;

import cc.infoq.common.translation.annotation.Translation;
import cc.infoq.common.translation.core.TranslationInterface;
import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.BeanProperty;
import com.fasterxml.jackson.databind.JavaType;
import com.fasterxml.jackson.databind.JsonSerializer;
import com.fasterxml.jackson.databind.SerializerProvider;
import com.fasterxml.jackson.databind.type.TypeFactory;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@Tag("dev")
class TranslationHandlerTest {

    @AfterEach
    void clearMapper() {
        TranslationHandler.TRANSLATION_MAPPER.clear();
    }

    @Test
    @DisplayName("serialize: should translate mapper field and write translated value")
    void serializeShouldTranslateMapperField() throws Exception {
        TranslationHandler handler = createConfiguredHandler();
        JsonGenerator gen = mock(JsonGenerator.class);
        when(gen.currentValue()).thenReturn(new DemoBean("mapped-value"));

        TranslationInterface<Object> trans = (key, other) -> key + "::" + other;
        TranslationHandler.TRANSLATION_MAPPER.put("demo.type", trans);

        handler.serialize("ignored", gen, null);

        verify(gen).writeObject("mapped-value::extra");
    }

    @Test
    @DisplayName("serialize: should write null when translated source value is null")
    void serializeShouldWriteNullWhenMappedValueIsNull() throws Exception {
        TranslationHandler handler = createConfiguredHandler();
        JsonGenerator gen = mock(JsonGenerator.class);
        when(gen.currentValue()).thenReturn(new DemoBean(null));

        TranslationInterface<Object> trans = (key, other) -> key;
        TranslationHandler.TRANSLATION_MAPPER.put("demo.type", trans);

        handler.serialize("ignored", gen, null);
        verify(gen).writeNull();
    }

    @Test
    @DisplayName("serialize: should fallback to raw value when translation throws")
    void serializeShouldFallbackWhenTranslationThrows() throws Exception {
        TranslationHandler handler = createConfiguredHandler();
        JsonGenerator gen = mock(JsonGenerator.class);
        when(gen.currentValue()).thenReturn(new DemoBean("mapped-value"));

        TranslationInterface<Object> trans = (key, other) -> {
            throw new IllegalStateException("boom");
        };
        TranslationHandler.TRANSLATION_MAPPER.put("demo.type", trans);

        handler.serialize("ignored", gen, null);
        verify(gen).writeObject("mapped-value");
    }

    @Test
    @DisplayName("serialize: should keep raw value when translation type is missing")
    void serializeShouldKeepRawValueWhenTypeMissing() throws Exception {
        TranslationHandler handler = createConfiguredHandler();
        JsonGenerator gen = mock(JsonGenerator.class);

        handler.serialize("raw", gen, null);
        verify(gen).writeObject("raw");
    }

    @Test
    @DisplayName("createContextual: should delegate to provider when annotation is absent")
    void createContextualShouldDelegateWhenAnnotationAbsent() throws Exception {
        TranslationHandler handler = new TranslationHandler();
        SerializerProvider provider = mock(SerializerProvider.class);
        BeanProperty property = mock(BeanProperty.class);
        JavaType javaType = TypeFactory.defaultInstance().constructType(String.class);
        JsonSerializer<Object> fallback = new JsonSerializer<>() {
            @Override
            public void serialize(Object value, JsonGenerator gen, SerializerProvider serializers) {
                // no-op serializer for testing fallback branch only
            }
        };

        when(property.getAnnotation(Translation.class)).thenReturn(null);
        when(property.getType()).thenReturn(javaType);
        when(provider.findValueSerializer(javaType, property)).thenReturn(fallback);

        JsonSerializer<?> serializer = handler.createContextual(provider, property);
        assertSame(fallback, serializer);
    }

    private static TranslationHandler createConfiguredHandler() throws Exception {
        TranslationHandler handler = new TranslationHandler();
        SerializerProvider provider = mock(SerializerProvider.class);
        BeanProperty property = mock(BeanProperty.class);
        JavaType javaType = TypeFactory.defaultInstance().constructType(String.class);
        Translation translation = DemoTarget.class.getDeclaredField("translated").getAnnotation(Translation.class);

        when(property.getAnnotation(Translation.class)).thenReturn(translation);
        when(property.getType()).thenReturn(javaType);
        JsonSerializer<?> serializer = handler.createContextual(provider, property);
        assertSame(handler, serializer);
        return handler;
    }

    private static class DemoBean {
        private final String mappedField;

        private DemoBean(String mappedField) {
            this.mappedField = mappedField;
        }

        public String getMappedField() {
            return mappedField;
        }
    }

    private static class DemoTarget {
        @Translation(type = "demo.type", mapper = "mappedField", other = "extra")
        private String translated;
    }
}
