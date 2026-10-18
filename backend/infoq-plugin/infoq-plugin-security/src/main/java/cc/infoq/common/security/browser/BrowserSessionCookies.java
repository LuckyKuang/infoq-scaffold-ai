package cc.infoq.common.security.browser;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

public class BrowserSessionCookies {
    public static final String PATH = "/auth/browser-session";
    public static final String SCOPE_HEADER = "X-InfoQ-Browser-Session";
    private final BrowserSessionProperties properties;

    public BrowserSessionCookies(BrowserSessionProperties properties) {
        this.properties = properties;
    }

    public String name(String scope, String clientId) {
        return (properties.isSecure() ? "__Secure-" : "") + "InfoQ-BS-" + scope + "-" + digest(clientId).substring(0, 16);
    }

    public String read(HttpServletRequest request, String scope, String clientId) {
        String name = name(scope, clientId);
        String found = null;
        if (request.getCookies() != null) {
            for (Cookie cookie : request.getCookies()) {
                if (name.equals(cookie.getName())) {
                    if (found != null) {
                        return "invalid-duplicate-cookie";
                    }
                    found = cookie.getValue();
                }
            }
        }
        return found;
    }

    public void write(HttpServletResponse response, String scope, String clientId, String handle, long maxAge) {
        response.addHeader(HttpHeaders.SET_COOKIE, ResponseCookie.from(name(scope, clientId), handle)
            .path(properties.getCookiePath()).httpOnly(true).secure(properties.isSecure())
            .sameSite("Strict").maxAge(maxAge).build().toString());
    }

    public static String digest(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }
}
