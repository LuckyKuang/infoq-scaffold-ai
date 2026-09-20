package cc.infoq.common.web.config;

import cc.infoq.common.web.core.I18nLocaleResolver;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.AutoConfigureBefore;
import org.springframework.boot.autoconfigure.AutoConfigureOrder;
import org.springframework.boot.webmvc.autoconfigure.WebMvcAutoConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.core.Ordered;
import org.springframework.web.servlet.DispatcherServlet;
import org.springframework.web.servlet.LocaleResolver;

/**
 * 国际化配置。必须先于 WebMvc 注册同名 localeResolver，否则 Spring Boot 4
 * 会因为不允许 bean overriding 而启动失败。
 *
 * @author Pontus
 */
@AutoConfiguration
@AutoConfigureBefore(WebMvcAutoConfiguration.class)
@AutoConfigureOrder(Ordered.HIGHEST_PRECEDENCE)
public class I18nConfig {

    @Bean(name = DispatcherServlet.LOCALE_RESOLVER_BEAN_NAME)
    public LocaleResolver localeResolver() {
        return new I18nLocaleResolver();
    }

}
