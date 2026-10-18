package cc.infoq.common.sensitive.handler;

import cc.infoq.common.sensitive.annotation.Sensitive;
import cc.infoq.common.sensitive.core.SensitiveService;
import cc.infoq.common.sensitive.core.SensitiveStrategy;
import cc.infoq.common.utils.SpringUtils;
import tools.jackson.core.JsonGenerator;
import tools.jackson.databind.BeanProperty;
import tools.jackson.databind.JavaType;
import tools.jackson.databind.ValueSerializer;
import tools.jackson.databind.SerializationContext;
import tools.jackson.databind.type.TypeFactory;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.context.support.GenericApplicationContext;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@Tag("dev")
class SensitiveHandlerTest {

    @Test
    @DisplayName("serialize: should desensitize value when SensitiveService returns true")
    void serializeShouldDesensitizeWhenSensitiveServiceReturnsTrue() throws Exception {
        SensitiveService sensitiveService = mock(SensitiveService.class);
        when(sensitiveService.isSensitive(any(), any())).thenReturn(true);
        initContext(sensitiveService);

        SensitiveHandler handler = createConfiguredHandler();
        tools.jackson.core.JsonGenerator gen = mock(tools.jackson.core.JsonGenerator.class);

        handler.serialize("13800138000", gen, null);

        verify(sensitiveService).isSensitive(eq(new String[]{"admin"}), eq(new String[]{"system:user:read"}));
        verify(gen).writeString(argThat((String value) -> value != null && !value.equals("13800138000")));
    }

    @Test
    @DisplayName("serialize: should keep raw value when SensitiveService returns false")
    void serializeShouldKeepRawWhenSensitiveServiceReturnsFalse() throws Exception {
        SensitiveService sensitiveService = mock(SensitiveService.class);
        when(sensitiveService.isSensitive(any(), any())).thenReturn(false);
        initContext(sensitiveService);

        SensitiveHandler handler = createConfiguredHandler();
        tools.jackson.core.JsonGenerator gen = mock(tools.jackson.core.JsonGenerator.class);

        handler.serialize("13800138000", gen, null);

        verify(gen).writeString("13800138000");
    }

    @Test
    @DisplayName("serialize: should fallback to raw value when SensitiveService bean is missing")
    void serializeShouldFallbackToRawWhenBeanMissing() throws Exception {
        initContext(null);
        SensitiveHandler handler = createConfiguredHandler();
        tools.jackson.core.JsonGenerator gen = mock(tools.jackson.core.JsonGenerator.class);

        handler.serialize("13800138000", gen, null);

        verify(gen).writeString("13800138000");
    }

    @Test
    @DisplayName("createContextual: should delegate to provider when annotation is absent")
    void createContextualShouldDelegateWhenAnnotationAbsent() throws Exception {
        SensitiveHandler handler = new SensitiveHandler();
        SerializationContext provider = mock(SerializationContext.class);
        BeanProperty property = mock(BeanProperty.class);
        JavaType javaType = TypeFactory.createDefaultInstance().constructType(String.class);
        ValueSerializer<Object> fallback = mockValueSerializer();

        when(property.getAnnotation(Sensitive.class)).thenReturn(null);
        when(property.getType()).thenReturn(javaType);
        when(provider.findValueSerializer(javaType)).thenReturn(fallback);

        ValueSerializer<?> serializer = handler.createContextual(provider, property);
        assertSame(fallback, serializer);
    }

    private static SensitiveHandler createConfiguredHandler() throws Exception {
        SensitiveHandler handler = new SensitiveHandler();
        SerializationContext provider = mock(SerializationContext.class);
        BeanProperty property = mock(BeanProperty.class);
        JavaType javaType = TypeFactory.createDefaultInstance().constructType(String.class);
        Sensitive annotation = DemoBean.class.getDeclaredField("phone").getAnnotation(Sensitive.class);

        when(property.getAnnotation(Sensitive.class)).thenReturn(annotation);
        when(property.getType()).thenReturn(javaType);
        ValueSerializer<?> serializer = handler.createContextual(provider, property);
        assertSame(handler, serializer);
        return handler;
    }

    private static ValueSerializer<Object> mockValueSerializer() {
        return new ValueSerializer<>() {
            @Override
            public void serialize(Object value, JsonGenerator gen, SerializationContext context) {
                // no-op serializer for testing fallback wiring only
            }
        };
    }

    private static void initContext(SensitiveService sensitiveService) {
        GenericApplicationContext context = new GenericApplicationContext();
        if (sensitiveService != null) {
            context.registerBean(SensitiveService.class, () -> sensitiveService);
        }
        context.refresh();
        new SpringUtils().setApplicationContext(context);
    }

    private static class DemoBean {
        @Sensitive(strategy = SensitiveStrategy.PHONE, roleKey = {"admin"}, perms = {"system:user:read"})
        private String phone;
    }
}
