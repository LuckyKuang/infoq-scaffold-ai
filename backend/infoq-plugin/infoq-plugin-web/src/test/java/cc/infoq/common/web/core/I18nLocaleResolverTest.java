package cc.infoq.common.web.core;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.Locale;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;

@Tag("dev")
class I18nLocaleResolverTest {

    @Test
    @DisplayName("resolveLocale: should use default locale when header missing")
    void resolveLocaleShouldUseDefaultWhenHeaderMissing() {
        I18nLocaleResolver resolver = new I18nLocaleResolver();
        MockHttpServletRequest request = new MockHttpServletRequest();

        Locale locale = resolver.resolveLocale(request);

        assertEquals(Locale.getDefault(), locale);
    }

    @Test
    @DisplayName("resolveLocale/setLocale: should parse content-language and allow no-op set")
    void resolveLocaleShouldParseHeaderAndSetLocaleNoOp() {
        I18nLocaleResolver resolver = new I18nLocaleResolver();
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("content-language", "zh_CN");
        MockHttpServletResponse response = new MockHttpServletResponse();

        Locale locale = resolver.resolveLocale(request);

        assertEquals(new Locale("zh", "CN"), locale);
        assertDoesNotThrow(() -> resolver.setLocale(request, response, Locale.US));
    }

    @Test
    @DisplayName("resolveLocale: should parse BCP 47 language tags")
    void resolveLocaleShouldParseBcp47LanguageTag() {
        I18nLocaleResolver resolver = new I18nLocaleResolver();
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("content-language", "zh-CN");

        Locale locale = resolver.resolveLocale(request);

        assertEquals(new Locale("zh", "CN"), locale);
    }

    @Test
    @DisplayName("resolveLocale: should parse language-only header")
    void resolveLocaleShouldParseLanguageOnlyHeader() {
        I18nLocaleResolver resolver = new I18nLocaleResolver();
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("content-language", "en");

        Locale locale = resolver.resolveLocale(request);

        assertEquals(Locale.ENGLISH, locale);
    }
}
