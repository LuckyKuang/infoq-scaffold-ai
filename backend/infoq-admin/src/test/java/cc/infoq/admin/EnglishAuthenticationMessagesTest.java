package cc.infoq.admin;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.context.support.ResourceBundleMessageSource;

import java.util.Locale;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

@Tag("dev")
class EnglishAuthenticationMessagesTest {
    @Test
    void authenticationMessagesResolveThroughMessageSource() {
        ResourceBundleMessageSource source = new ResourceBundleMessageSource();
        source.setBasename("i18n/messages");
        source.setDefaultEncoding("UTF-8");
        source.setFallbackToSystemLocale(false);
        Map.of(
            "email.code.scene.not.blank", "Email verification scene cannot be blank",
            "email.code.scene.not.valid", "Email verification scene is invalid",
            "user.email.already.exists", "This email address is already in use",
            "user.forgot.password.invalid", "The password reset request is invalid or expired"
        ).forEach((key, expected) -> assertEquals(expected, source.getMessage(key, null, Locale.US)));
    }
}
