package cc.infoq.common.json.config;

import cc.infoq.common.json.handler.CustomDateDeserializer;
import cc.infoq.common.json.handler.Jackson3BigNumberSerializer;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.jackson.autoconfigure.JsonMapperBuilderCustomizer;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.SerializationFeature;
import tools.jackson.databind.ext.javatime.deser.LocalDateTimeDeserializer;
import tools.jackson.databind.ext.javatime.ser.LocalDateTimeSerializer;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.module.SimpleModule;
import tools.jackson.databind.ser.std.ToStringSerializer;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.time.format.DateTimeFormatter;
import java.util.Date;
import java.util.TimeZone;

/**
 * Spring Boot 4 MVC 的 Jackson 3 统一配置。
 *
 * <p>业务 JSON、Redis codec 与 MVC 共享同一套 Jackson 3 规则；不再保留 Jackson 2 兼容层。</p>
 *
 * @author Pontus
 */
@AutoConfiguration
public class Jackson3Customizer implements JsonMapperBuilderCustomizer {

    private static final DateTimeFormatter DATE_TIME_FORMATTER =
        DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    @Override
    public void customize(JsonMapper.Builder builder) {
        SimpleModule module = new SimpleModule("infoqJackson");
        module.addSerializer(Long.class, Jackson3BigNumberSerializer.INSTANCE);
        module.addSerializer(Long.TYPE, Jackson3BigNumberSerializer.INSTANCE);
        module.addSerializer(BigInteger.class, Jackson3BigNumberSerializer.INSTANCE);
        module.addSerializer(BigDecimal.class, ToStringSerializer.instance);
        module.addSerializer(java.time.LocalDateTime.class, new LocalDateTimeSerializer(DATE_TIME_FORMATTER));
        module.addDeserializer(java.time.LocalDateTime.class, new LocalDateTimeDeserializer(DATE_TIME_FORMATTER));
        module.addDeserializer(Date.class, new CustomDateDeserializer());
        builder.addModule(module)
            .enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
            .disable(SerializationFeature.FAIL_ON_EMPTY_BEANS)
            .defaultTimeZone(TimeZone.getDefault());
    }
}
