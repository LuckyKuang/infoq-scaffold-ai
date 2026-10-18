package cc.infoq.common.security.browser;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.web.csrf.CsrfTokenRepository;

import java.util.Map;

/** Two immutable cookie policies keep concurrent React/Vue requests isolated. */
public class BrowserSessionCsrfRepository implements CsrfTokenRepository {
    private final Map<String, CookieCsrfTokenRepository> repositories;

    public BrowserSessionCsrfRepository(BrowserSessionProperties properties) {
        repositories = Map.of("react", create(properties, "react"), "vue", create(properties, "vue"));
    }

    private CookieCsrfTokenRepository create(BrowserSessionProperties properties, String scope) {
        CookieCsrfTokenRepository repository = new CookieCsrfTokenRepository();
        repository.setCookieName((properties.isSecure() ? "__Secure-" : "") + "InfoQ-CSRF-" + scope);
        repository.setCookieCustomizer(cookie -> cookie.path(properties.getCookiePath()).httpOnly(true)
            .secure(properties.isSecure()).sameSite("Strict")
            .maxAge(cookie.build().getValue().isEmpty() ? 0 : properties.getTtlSeconds()));
        return repository;
    }

    private CookieCsrfTokenRepository repository(HttpServletRequest request) {
        CookieCsrfTokenRepository repository = repositories.get(request.getHeader(BrowserSessionCookies.SCOPE_HEADER));
        if (repository == null) {
            throw new IllegalArgumentException("invalid browser session scope");
        }
        return repository;
    }

    @Override
    public CsrfToken generateToken(HttpServletRequest request) {
        return repository(request).generateToken(request);
    }

    @Override
    public void saveToken(CsrfToken token, HttpServletRequest request, HttpServletResponse response) {
        repository(request).saveToken(token, request, response);
    }

    @Override
    public CsrfToken loadToken(HttpServletRequest request) {
        return repository(request).loadToken(request);
    }
}
