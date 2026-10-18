package cc.infoq.common.web.config;

import cc.infoq.common.web.core.I18nLocaleResolver;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.web.servlet.LocaleResolver;

import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;

@Tag("dev")
class I18nConfigTest {

    @Test
    @DisplayName("localeResolver: should create i18n locale resolver")
    void localeResolverShouldCreateI18nResolver() {
        I18nConfig config = new I18nConfig();

        LocaleResolver resolver = config.localeResolver();

        assertNotNull(resolver);
        assertInstanceOf(I18nLocaleResolver.class, resolver);
    }
}
