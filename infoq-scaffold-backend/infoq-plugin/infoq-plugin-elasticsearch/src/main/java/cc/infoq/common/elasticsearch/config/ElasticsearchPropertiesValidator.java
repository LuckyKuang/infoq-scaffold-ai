package cc.infoq.common.elasticsearch.config;

import java.net.URI;
import java.time.Duration;
import java.util.List;

final class ElasticsearchPropertiesValidator {

    private ElasticsearchPropertiesValidator() {
    }

    static void validate(ElasticsearchProperties properties) {
        if (!properties.isEnabled()) {
            return;
        }
        if (properties.getUris() == null) {
            throw new IllegalStateException("infoq.elasticsearch.enabled=true requires at least one URI");
        }
        List<String> uris = properties.getUris().stream()
            .filter(uri -> uri != null && !uri.isBlank())
            .toList();
        if (uris.isEmpty()) {
            throw new IllegalStateException("infoq.elasticsearch.enabled=true requires at least one URI");
        }
        boolean usernamePresent = properties.getUsername() != null && !properties.getUsername().isBlank();
        boolean passwordPresent = properties.getPassword() != null && !properties.getPassword().isBlank();
        if (usernamePresent != passwordPresent) {
            throw new IllegalStateException("Elasticsearch username and password must be configured together");
        }
        validateTimeout(properties.getConnectTimeout(), "connect");
        validateTimeout(properties.getRequestTimeout(), "request");
        for (String value : uris) {
            URI uri;
            try {
                uri = URI.create(value);
            } catch (IllegalArgumentException ex) {
                throw new IllegalStateException("Elasticsearch URI is invalid", ex);
            }
            if (uri.getScheme() == null || uri.getHost() == null) {
                throw new IllegalStateException("Elasticsearch URI must include scheme and host");
            }
            if (properties.isTlsEnabled() && !"https".equalsIgnoreCase(uri.getScheme())) {
                throw new IllegalStateException("Elasticsearch TLS requires https URI");
            }
            if (!properties.isTlsEnabled() && !"http".equalsIgnoreCase(uri.getScheme())) {
                throw new IllegalStateException("Elasticsearch without TLS requires http URI");
            }
        }
    }

    private static void validateTimeout(Duration timeout, String name) {
        if (timeout == null || timeout.isNegative() || timeout.isZero()) {
            throw new IllegalStateException("Elasticsearch " + name + " timeout must be positive");
        }
        long millis;
        try {
            millis = timeout.toMillis();
        } catch (ArithmeticException ex) {
            throw new IllegalStateException("Elasticsearch " + name + " timeout is too large", ex);
        }
        if (millis < 1 || millis > Integer.MAX_VALUE) {
            throw new IllegalStateException("Elasticsearch " + name + " timeout must be between 1 millisecond and "
                + Integer.MAX_VALUE + " milliseconds");
        }
    }
}
