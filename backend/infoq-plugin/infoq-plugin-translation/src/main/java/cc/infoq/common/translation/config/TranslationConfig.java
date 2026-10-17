package cc.infoq.common.translation.config;

import cc.infoq.common.translation.annotation.TranslationType;
import cc.infoq.common.translation.core.TranslationInterface;
import cc.infoq.common.translation.core.handler.TranslationBeanSerializerModifier;
import cc.infoq.common.translation.core.handler.TranslationHandler;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.jackson.autoconfigure.JsonMapperBuilderCustomizer;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.module.SimpleModule;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 翻译模块配置类。
 *
 * @author Pontus
 */
@Slf4j
@AutoConfiguration
public class TranslationConfig implements JsonMapperBuilderCustomizer {

    @Autowired
    private List<TranslationInterface<?>> list;

    @PostConstruct
    public void init() {
        Map<String, TranslationInterface<?>> map = new HashMap<>(list.size());
        for (TranslationInterface<?> trans : list) {
            if (trans.getClass().isAnnotationPresent(TranslationType.class)) {
                TranslationType annotation = trans.getClass().getAnnotation(TranslationType.class);
                map.put(annotation.type(), trans);
            } else {
                log.warn(trans.getClass().getName() + " 翻译实现类未标注 TranslationType 注解!");
            }
        }
        TranslationHandler.TRANSLATION_MAPPER.putAll(map);
    }

    @Override
    public void customize(JsonMapper.Builder builder) {
        SimpleModule module = new SimpleModule("infoqTranslation");
        module.setSerializerModifier(new TranslationBeanSerializerModifier());
        builder.addModule(module);
    }
}
