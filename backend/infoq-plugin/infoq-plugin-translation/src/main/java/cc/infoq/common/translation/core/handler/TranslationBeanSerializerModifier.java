package cc.infoq.common.translation.core.handler;

import tools.jackson.databind.BeanDescription;
import tools.jackson.databind.SerializationConfig;
import tools.jackson.databind.ValueSerializer;
import tools.jackson.databind.ser.BeanPropertyWriter;
import tools.jackson.databind.ser.ValueSerializerModifier;

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
            ValueSerializer<Object> serializer = writer.getSerializer();
            if (serializer instanceof TranslationHandler translationHandler) {
                writer.assignNullSerializer(translationHandler);
            }
        }
        return beanProperties;
    }
}
