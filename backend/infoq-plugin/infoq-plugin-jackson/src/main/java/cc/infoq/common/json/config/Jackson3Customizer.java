package cc.infoq.common.json.config;

import cc.infoq.common.json.handler.Jackson3BigNumberSerializer;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.jackson.autoconfigure.JsonMapperBuilderCustomizer;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.module.SimpleModule;

import java.math.BigInteger;

/**
 * Jackson 3（Spring Boot MVC 默认 JsonMapper）的大数序列化保护。
 * Jackson 2 侧保护见 {@link JacksonConfig}；两侧阈值保持一致。
 *
 * @author Pontus
 */
@AutoConfiguration
public class Jackson3Customizer implements JsonMapperBuilderCustomizer {

    @Override
    public void customize(JsonMapper.Builder builder) {
        SimpleModule module = new SimpleModule("infoqBigNumber");
        module.addSerializer(Long.class, Jackson3BigNumberSerializer.INSTANCE);
        module.addSerializer(Long.TYPE, Jackson3BigNumberSerializer.INSTANCE);
        module.addSerializer(BigInteger.class, Jackson3BigNumberSerializer.INSTANCE);
        builder.addModule(module);
    }
}