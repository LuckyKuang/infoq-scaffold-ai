package cc.infoq.common.translation.core.handler;

import cc.infoq.common.translation.annotation.Translation;
import cc.infoq.common.translation.core.TranslationInterface;
import cc.infoq.common.utils.StringUtils;
import cc.infoq.common.utils.reflect.ReflectUtils;
import cn.hutool.core.util.ObjectUtil;
import lombok.extern.slf4j.Slf4j;
import tools.jackson.core.JacksonException;
import tools.jackson.core.JsonGenerator;
import tools.jackson.databind.BeanProperty;
import tools.jackson.databind.SerializationContext;
import tools.jackson.databind.ValueSerializer;

import java.util.Map;
import java.util.Objects;
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

    private Translation translation;

    @Override
    public void serialize(Object value, JsonGenerator gen, SerializationContext context) throws JacksonException {
        TranslationInterface<?> trans = TRANSLATION_MAPPER.get(translation.type());
        if (ObjectUtil.isNotNull(trans)) {
            if (StringUtils.isNotBlank(translation.mapper())) {
                value = ReflectUtils.invokeGetter(gen.currentValue(), translation.mapper());
            }
            if (ObjectUtil.isNull(value)) {
                gen.writeNull();
                return;
            }
            try {
                Object result = trans.translation(value, translation.other());
                context.writeValue(gen, result);
            } catch (Exception e) {
                log.error("翻译处理异常，type: {}, value: {}", translation.type(), value, e);
                context.writeValue(gen, value);
            }
        } else {
            context.writeValue(gen, value);
        }
    }

    @Override
    public ValueSerializer<?> createContextual(SerializationContext context, BeanProperty property) {
        Translation translation = property.getAnnotation(Translation.class);
        if (Objects.nonNull(translation)) {
            this.translation = translation;
            return this;
        }
        return context.findValueSerializer(property.getType());
    }
}
