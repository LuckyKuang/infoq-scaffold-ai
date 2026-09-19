package cc.infoq.common.web.config;

import cc.infoq.common.web.core.I18nLocaleResolver;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.web.servlet.LocaleResolver;

/**
 * 国际化配置
 *
 * @author Pontus
 */
@AutoConfiguration
public class I18nConfig {

    @Bean
    public LocaleResolver localeResolver() {
        return new I18nLocaleResolver();
    }

}
