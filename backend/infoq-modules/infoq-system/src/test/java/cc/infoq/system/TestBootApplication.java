package cc.infoq.system;

import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;

/**
 * 测试专用启动配置。
 * 在生产启动类迁移到 infoq-admin 后，保留 test scope 的 SpringBootConfiguration，
 * 供 infoq-system 内部的 @MybatisTest / Spring 测试上下文定位。
 */
@SpringBootConfiguration(proxyBeanMethods = false)
@EnableAutoConfiguration
class TestBootApplication {
}
