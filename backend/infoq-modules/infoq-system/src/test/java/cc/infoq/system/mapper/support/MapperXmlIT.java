package cc.infoq.system.mapper.support;

import org.junit.jupiter.api.Tag;
import org.mybatis.spring.annotation.MapperScan;
import org.mybatis.spring.boot.test.autoconfigure.MybatisTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.context.jdbc.Sql.ExecutionPhase;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Tag("dev")
@MybatisTest
@Import(MapperXmlIT.MapperXmlScanConfig.class)
@TestPropertySource(properties = {
    "spring.datasource.url=jdbc:h2:mem:mapper_it;MODE=MySQL;DATABASE_TO_LOWER=TRUE;CASE_INSENSITIVE_IDENTIFIERS=TRUE;DB_CLOSE_DELAY=-1",
    "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.datasource.username=sa",
    "spring.datasource.password=",
    "mybatis.mapper-locations=classpath*:mapper/system/*Mapper.xml",
    "mybatis.configuration.map-underscore-to-camel-case=true",
    "mybatis-plus.mapper-locations=classpath*:mapper/system/*Mapper.xml",
    "mybatis-plus.configuration.map-underscore-to-camel-case=true"
})
@Sql(
    scripts = {
        "classpath:sql/mapper-it/schema.sql",
        "classpath:sql/mapper-it/data.sql"
    },
    executionPhase = ExecutionPhase.BEFORE_TEST_METHOD
)
public @interface MapperXmlIT {

    @TestConfiguration(proxyBeanMethods = false)
    @MapperScan("cc.infoq.system.mapper")
    class MapperXmlScanConfig {
    }
}
