package cc.infoq.common.translation.core.handler;

import cc.infoq.common.translation.annotation.Translation;
import cc.infoq.common.translation.core.TranslationInterface;
import tools.jackson.core.JsonGenerator;
import tools.jackson.databind.BeanProperty;
import tools.jackson.databind.JavaType;
import tools.jackson.databind.ValueSerializer;
import tools.jackson.databind.SerializationContext;
import tools.jackson.databind.type.TypeFactory;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.never;
import static org.mockito.ArgumentMatchers.any;

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
        SerializationContext context = mock(SerializationContext.class);
        when(gen.currentValue()).thenReturn(new DemoBean("mapped-value"));

        TranslationInterface<Object> trans = (key, other) -> key + "::" + other;
        TranslationHandler.TRANSLATION_MAPPER.put("demo.type", trans);

        handler.serialize("ignored", gen, context);

        verify(context).writeValue(gen, "mapped-value::extra");
    }

    @Test
    @DisplayName("serialize: should write null when translated source value is null")
    void serializeShouldWriteNullWhenMappedValueIsNull() throws Exception {
        TranslationHandler handler = createConfiguredHandler();
        JsonGenerator gen = mock(JsonGenerator.class);
        SerializationContext context = mock(SerializationContext.class);
        when(gen.currentValue()).thenReturn(new DemoBean(null));

        TranslationInterface<Object> trans = (key, other) -> key;
        TranslationHandler.TRANSLATION_MAPPER.put("demo.type", trans);

        handler.serialize("ignored", gen, context);
        verify(gen).writeNull();
    }

    @Test
    @DisplayName("serialize: should fail without raw value when translation throws")
    void serializeShouldFailWhenTranslationThrows() throws Exception {
        TranslationHandler handler = createConfiguredHandler();
        JsonGenerator gen = mock(JsonGenerator.class);
        SerializationContext context = mock(SerializationContext.class);
        when(gen.currentValue()).thenReturn(new DemoBean("mapped-value"));

        TranslationInterface<Object> trans = (key, other) -> {
            throw new IllegalStateException("boom");
        };
        TranslationHandler.TRANSLATION_MAPPER.put("demo.type", trans);

        IllegalStateException failure = assertThrows(IllegalStateException.class, () -> handler.serialize("ignored", gen, context));
        assertTrue(failure.getMessage().contains("stage=translation"));
        assertFalse(failure.getMessage().contains("mapped-value"));
        assertFalse(failure.getMessage().contains("boom"));
        assertNull(failure.getCause());
        verify(context, never()).writeValue(any(), any());
    }

    @Test
    @DisplayName("serialize: should fail when translation type is missing")
    void serializeShouldFailWhenTypeMissing() throws Exception {
        TranslationHandler handler = createConfiguredHandler();
        JsonGenerator gen = mock(JsonGenerator.class);
        SerializationContext context = mock(SerializationContext.class);

        when(gen.currentValue()).thenReturn(new DemoBean("mapped-value"));
        IllegalStateException failure = assertThrows(IllegalStateException.class, () -> handler.serialize("raw", gen, context));
        assertTrue(failure.getMessage().contains("stage=lookup"));
        verify(context, never()).writeValue(any(), any());
    }

    @Test
    @DisplayName("createContextual: should delegate to provider when annotation is absent")
    void createContextualShouldDelegateWhenAnnotationAbsent() throws Exception {
        TranslationHandler handler = new TranslationHandler();
        SerializationContext provider = mock(SerializationContext.class);
        BeanProperty property = mock(BeanProperty.class);
        JavaType javaType = TypeFactory.createDefaultInstance().constructType(String.class);
        ValueSerializer<Object> fallback = new ValueSerializer<>() {
            @Override
            public void serialize(Object value, JsonGenerator gen, SerializationContext context) {
                // no-op serializer for testing fallback branch only
            }
        };

        when(property.getAnnotation(Translation.class)).thenReturn(null);
        when(property.getType()).thenReturn(javaType);
        when(provider.findValueSerializer(javaType)).thenReturn(fallback);

        ValueSerializer<?> serializer = handler.createContextual(provider, property);
        assertSame(fallback, serializer);
    }

    private static TranslationHandler createConfiguredHandler() throws Exception {
        TranslationHandler handler = new TranslationHandler();
        SerializationContext provider = mock(SerializationContext.class);
        BeanProperty property = mock(BeanProperty.class);
        JavaType javaType = TypeFactory.createDefaultInstance().constructType(String.class);
        Translation translation = DemoTarget.class.getDeclaredField("translated").getAnnotation(Translation.class);

        when(property.getAnnotation(Translation.class)).thenReturn(translation);
        when(property.getType()).thenReturn(javaType);
        ValueSerializer<?> serializer = handler.createContextual(provider, property);
        assertNotSame(handler, serializer);
        return (TranslationHandler) serializer;
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
