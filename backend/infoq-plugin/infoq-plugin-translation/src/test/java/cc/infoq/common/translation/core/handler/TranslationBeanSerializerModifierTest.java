package cc.infoq.common.translation.core.handler;

import tools.jackson.databind.ValueSerializer;
import tools.jackson.databind.SerializationContext;
import tools.jackson.databind.ser.BeanPropertyWriter;
import tools.jackson.core.JsonGenerator;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.Mockito.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@Tag("dev")
class TranslationBeanSerializerModifierTest {

    @Test
    @DisplayName("changeProperties: should assign null serializer when serializer is translation handler")
    void changePropertiesShouldAssignNullSerializerForTranslationHandler() {
        TranslationBeanSerializerModifier modifier = new TranslationBeanSerializerModifier();
        TranslationHandler translationHandler = new TranslationHandler();

        BeanPropertyWriter translationWriter = mock(BeanPropertyWriter.class);
        BeanPropertyWriter normalWriter = mock(BeanPropertyWriter.class);
        ValueSerializer<Object> normalSerializer = new ValueSerializer<>() {
            @Override
            public void serialize(Object value, JsonGenerator gen, SerializationContext context) {
                // no-op serializer for testing wiring behavior only
            }
        };

        when(translationWriter.getSerializer()).thenReturn(translationHandler);
        when(normalWriter.getSerializer()).thenReturn(normalSerializer);

        List<BeanPropertyWriter> writers = new ArrayList<>(List.of(translationWriter, normalWriter));
        List<BeanPropertyWriter> result = modifier.changeProperties(null, null, writers);

        assertSame(writers, result);
        verify(translationWriter).assignNullSerializer(translationHandler);
        verify(normalWriter, never()).assignNullSerializer(any());
    }
}
