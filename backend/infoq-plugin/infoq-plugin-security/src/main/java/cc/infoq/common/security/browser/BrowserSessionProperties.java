package cc.infoq.common.security.browser;

import lombok.Data;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.net.URI;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Data
@ConfigurationProperties("security.browser-session")
public class BrowserSessionProperties implements InitializingBean {

    private String deploymentMode = "development";
    private String publicBaseUrl = "";
    private List<String> origins = List.of("http://localhost", "http://127.0.0.1");
    private String cookiePath = "/dev-api/auth/browser-session";
    private boolean secure;
    private long ttlSeconds = 2592000;
    private Set<String> allowedOrigins = Set.of();

    @Override
    public void afterPropertiesSet() {
        boolean production = "production".equals(deploymentMode);
        if (!production && !"development".equals(deploymentMode)) {
            throw new IllegalArgumentException("security.browser-session.deployment-mode must be production or development");
        }
        if (ttlSeconds <= 0 || ttlSeconds > 2592000) {
            throw new IllegalArgumentException("browser session TTL must be 1..2592000 seconds");
        }
        if (!Set.of("/prod-api/auth/browser-session", "/dev-api/auth/browser-session").contains(cookiePath)
            || production && !"/prod-api/auth/browser-session".equals(cookiePath)) {
            throw new IllegalArgumentException("browser session cookie path must match the external API prefix");
        }
        Set<String> configured = new LinkedHashSet<>();
        if (publicBaseUrl != null && !publicBaseUrl.isBlank()) {
            URI base = URI.create(publicBaseUrl);
            if (base.getRawQuery() != null || base.getRawFragment() != null || base.getUserInfo() != null) {
                throw new IllegalArgumentException("browser session public URL contains unsupported components");
            }
            if (base.getRawPath() != null && !base.getRawPath().isEmpty() && !"/".equals(base.getRawPath())) {
                throw new IllegalArgumentException("browser session public URL must be a root origin");
            }
            configured.add(origin(base, true));
        }
        if (production) {
            if (!secure || configured.isEmpty() || !configured.iterator().next().startsWith("https://")
                || origins != null && !origins.isEmpty()) {
                throw new IllegalArgumentException("production browser sessions require HTTPS, Secure cookies and only INFOQ_PUBLIC_BASE_URL");
            }
        } else {
            if (origins != null) {
                for (String value : origins) {
                    if (value == null || value.isBlank()) {
                        throw new IllegalArgumentException("development browser session origins must not contain empty values");
                    }
                    configured.add(normalizeOrigin(value));
                }
            }
            if (configured.isEmpty()) {
                throw new IllegalArgumentException("development browser sessions require explicit loopback origins");
            }
            for (String value : configured) {
                URI uri = URI.create(value);
                String host = uri.getHost();
                if (!"http".equals(uri.getScheme()) || !("localhost".equals(host) || host.endsWith(".localhost")
                    || "127.0.0.1".equals(host) || "[::1]".equals(host) || "::1".equals(host))) {
                    throw new IllegalArgumentException("development browser sessions require exact HTTP loopback origins");
                }
            }
        }
        allowedOrigins = Set.copyOf(configured);
    }

    public static String normalizeOrigin(String value) {
        return origin(URI.create(value), false);
    }

    private static String origin(URI uri, boolean allowPath) {
        String scheme = uri.getScheme();
        if (scheme == null || !(scheme.equalsIgnoreCase("http") || scheme.equalsIgnoreCase("https"))
            || uri.getHost() == null || uri.getUserInfo() != null || uri.getRawQuery() != null || uri.getRawFragment() != null
            || !allowPath && uri.getRawPath() != null && !uri.getRawPath().isEmpty() && !"/".equals(uri.getRawPath())
            || uri.getPort() > 65535 || uri.getPort() == 0) {
            throw new IllegalArgumentException("invalid exact browser session origin");
        }
        scheme = scheme.toLowerCase(Locale.ROOT);
        int port = uri.getPort();
        if (port == ("https".equals(scheme) ? 443 : 80)) {
            port = -1;
        }
        return scheme + "://" + uri.getHost().toLowerCase(Locale.ROOT) + (port < 0 ? "" : ":" + port);
    }
}
