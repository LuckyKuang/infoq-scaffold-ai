package cc.infoq.common.oauth.support;

import cc.infoq.common.exception.ServiceException;
import cc.infoq.common.utils.MessageUtils;
import cc.infoq.common.utils.SpringUtils;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.MockedStatic;
import org.springframework.context.support.GenericApplicationContext;
import org.springframework.context.support.StaticMessageSource;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mockStatic;

@Tag("dev")
class OAuthRedirectValidatorTest {
    @BeforeAll
    static void messageContext() {
        GenericApplicationContext context = new GenericApplicationContext();
        context.registerBean("messageSource", StaticMessageSource.class, StaticMessageSource::new);
        context.refresh();
        new SpringUtils().setApplicationContext(context);
    }
    @Test
    void missingTargetUsesDefault() {
        assertEquals("/index", OAuthRedirectValidator.requireSafeRelativeRedirect(null));
    }

    @ParameterizedTest
    @ValueSource(strings = {"/", "/react/user/profile", "/vue/index?q=a%26b#section", "/search?q=100%25", "/p?q=a+b", "/p?x=100%25&y=%2526", "/p?q=hello world", "/p?q=中文#段落"})
    void safeTargetsPreserveTheirEncoding(String redirect) {
        assertEquals(redirect, OAuthRedirectValidator.requireSafeRelativeRedirect(redirect));
    }

    @ParameterizedTest
    @ValueSource(strings = {"", " ", " /index", "/index ", "https://evil.example", "//evil.example", "/\\evil",
        "/%2fevil", "/%252fevil", "/%5cevil", "/x%0d%0aLocation:evil", "/x\n", "/a/../b", "/%2e%2e/b",
        "/a//b", "/bad%", "/bad%zz", "/%c0%af", "/%ff", "/%e0%80%af",
        "/a%3F/%2e%2e/%2e%2e/outside", "/a%23/%252e%252e/outside", "/invalid{path", "/bad["})
    void unsafeTargetsFailWithoutEchoingInput(String redirect) {
        try (MockedStatic<MessageUtils> messages = mockStatic(MessageUtils.class)) {
            messages.when(() -> MessageUtils.message("auth.oauth.redirect.invalid")).thenReturn("Invalid redirect");
            ServiceException failure = assertThrows(ServiceException.class,
                () -> OAuthRedirectValidator.requireSafeRelativeRedirect(redirect));
            assertEquals("Invalid redirect", failure.getMessage());
        }
    }
}
