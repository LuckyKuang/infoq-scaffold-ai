package cc.infoq.common.oauth.support;

import cc.infoq.common.utils.ServletUtils;
import cc.infoq.common.utils.StringUtils;
import cn.hutool.crypto.SecureUtil;
import jakarta.servlet.http.HttpServletRequest;
import lombok.AccessLevel;
import lombok.NoArgsConstructor;

@NoArgsConstructor(access = AccessLevel.PRIVATE)
public final class OAuthBrowserBinding {

    public static String resolve(HttpServletRequest request) {
        if (request == null) {
            return StringUtils.EMPTY;
        }
        String userAgent = StringUtils.blankToDefault(request.getHeader("User-Agent"), StringUtils.EMPTY);
        String ip;
        try {
            ip = StringUtils.blankToDefault(ServletUtils.getClientIP(), StringUtils.EMPTY);
        } catch (IllegalStateException ignored) {
            ip = StringUtils.EMPTY;
        }
        return SecureUtil.sha256(userAgent + "|" + ip);
    }
}
