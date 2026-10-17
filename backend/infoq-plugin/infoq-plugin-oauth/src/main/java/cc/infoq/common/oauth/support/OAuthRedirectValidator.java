package cc.infoq.common.oauth.support;

import cc.infoq.common.exception.ServiceException;
import cc.infoq.common.utils.MessageUtils;
import cc.infoq.common.utils.StringUtils;
import lombok.AccessLevel;
import lombok.NoArgsConstructor;

@NoArgsConstructor(access = AccessLevel.PRIVATE)
public final class OAuthRedirectValidator {

    public static String requireSafeRelativeRedirect(String redirect) {
        String value = StringUtils.blankToDefault(redirect, "/index").trim();
        if (!value.startsWith("/")
            || value.startsWith("//")
            || value.contains("\\")
            || containsControl(value)
            || StringUtils.startsWithIgnoreCase(value, "http:")
            || StringUtils.startsWithIgnoreCase(value, "https:")) {
            throw new ServiceException(MessageUtils.message("auth.oauth.redirect.invalid"));
        }
        return value;
    }

    private static boolean containsControl(String value) {
        for (int i = 0; i < value.length(); i++) {
            if (Character.isISOControl(value.charAt(i))) {
                return true;
            }
        }
        return false;
    }
}
