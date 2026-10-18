package cc.infoq.common.translation.core.handler;

import tools.jackson.databind.BeanDescription;
import tools.jackson.databind.SerializationConfig;
import tools.jackson.databind.ValueSerializer;
import tools.jackson.databind.ser.BeanPropertyWriter;
import tools.jackson.databind.ser.ValueSerializerModifier;
import cc.infoq.common.translation.annotation.Translation;

import java.util.List;

/**
 * Bean 序列化修改器，解决 Translation 字段的 null 值单独处理问题。
 *
 * @author Pontus
 */
public class TranslationBeanSerializerModifier extends ValueSerializerModifier {

    @Override
    public List<BeanPropertyWriter> changeProperties(SerializationConfig config, BeanDescription.Supplier beanDesc,
                                                     List<BeanPropertyWriter> beanProperties) {
        for (BeanPropertyWriter writer : beanProperties) {
            Translation annotation = writer.getAnnotation(Translation.class);
            if (annotation != null) {
                writer.assignNullSerializer(new TranslationHandler(annotation, writer.getName()));
            }
        }
        return beanProperties;
    }
}
