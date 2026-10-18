package cc.infoq.common.translation.core.handler;

import cc.infoq.common.translation.annotation.Translation;

import tools.jackson.databind.ser.BeanPropertyWriter;
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
        BeanPropertyWriter translationWriter = mock(BeanPropertyWriter.class);
        BeanPropertyWriter normalWriter = mock(BeanPropertyWriter.class);

        when(translationWriter.getAnnotation(Translation.class)).thenReturn(mock(Translation.class));

        List<BeanPropertyWriter> writers = new ArrayList<>(List.of(translationWriter, normalWriter));
        List<BeanPropertyWriter> result = modifier.changeProperties(null, null, writers);

        assertSame(writers, result);
        verify(translationWriter).assignNullSerializer(any(TranslationHandler.class));
        verify(normalWriter, never()).assignNullSerializer(any());
    }
}
