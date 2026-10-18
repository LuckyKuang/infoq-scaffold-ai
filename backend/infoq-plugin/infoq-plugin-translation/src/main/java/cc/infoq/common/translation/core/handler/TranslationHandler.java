package cc.infoq.common.translation.core.handler;

import cc.infoq.common.translation.annotation.Translation;
import cc.infoq.common.translation.core.TranslationInterface;
import cc.infoq.common.utils.StringUtils;
import cc.infoq.common.utils.reflect.ReflectUtils;
import lombok.extern.slf4j.Slf4j;
import tools.jackson.core.JacksonException;
import tools.jackson.core.JsonGenerator;
import tools.jackson.databind.BeanProperty;
import tools.jackson.databind.SerializationContext;
import tools.jackson.databind.ValueSerializer;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 翻译处理器。
 *
 * @author Pontus
 */
@Slf4j
public class TranslationHandler extends ValueSerializer<Object> {

    /**
     * 全局翻译实现类映射器
     */
    public static final Map<String, TranslationInterface<?>> TRANSLATION_MAPPER = new ConcurrentHashMap<>();

    private final Translation translation;
    private final String field;

    public TranslationHandler() {
        this(null, "<unbound>");
    }

    public TranslationHandler(Translation translation, String field) {
        this.translation = translation;
        this.field = field;
    }

    @Override
    public void serialize(Object value, JsonGenerator gen, SerializationContext context) throws JacksonException {
        if (translation == null) {
            throw failure("context", "unbound", null);
        }
        TranslationInterface<?> trans = TRANSLATION_MAPPER.get(translation.type());
        if (trans == null) {
            throw failure("lookup", translation.type(), null);
        }
        try {
            if (StringUtils.isNotBlank(translation.mapper())) {
                value = ReflectUtils.invokeGetter(gen.currentValue(), translation.mapper());
            }
        } catch (RuntimeException e) {
            throw failure("mapper", translation.type(), e);
        }
        if (value == null) {
            gen.writeNull();
            return;
        }
        Object result;
        try {
            result = trans.translation(value, translation.other());
        } catch (Exception e) {
            throw failure("translation", translation.type(), e);
        }
        context.writeValue(gen, result);
    }

    @Override
    public ValueSerializer<?> createContextual(SerializationContext context, BeanProperty property) {
        if (property == null) {
            return this;
        }
        Translation annotation = property.getAnnotation(Translation.class);
        if (annotation != null) {
            return new TranslationHandler(annotation, property.getName());
        }
        return context.findValueSerializer(property.getType());
    }

    private IllegalStateException failure(String stage, String type, Exception cause) {
        String errorId = UUID.randomUUID().toString();
        String exceptionType = cause == null ? "none" : cause.getClass().getSimpleName();
        log.error("Translation failed, errorId:{}, stage:{}, type:{}, field:{}, exceptionType:{}",
            errorId, stage, type, field, exceptionType);
        // 原异常可能携带输入值；不附带 cause，避免后续异常处理链泄露它。
        return new IllegalStateException("Translation failed: errorId=" + errorId + ", stage=" + stage
            + ", type=" + type + ", field=" + field + ", exceptionType=" + exceptionType);
    }
}
