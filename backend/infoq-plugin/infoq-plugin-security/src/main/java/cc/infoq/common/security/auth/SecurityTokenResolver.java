package cc.infoq.common.security.auth;

import cc.infoq.common.utils.StringUtils;
import jakarta.servlet.http.HttpServletRequest;

import java.util.Locale;
import java.util.Optional;

/**
 * 解析当前前端请求头令牌和实时连接查询参数令牌
 */
public class SecurityTokenResolver {

    private final SecurityTokenProperties properties;

    public SecurityTokenResolver(SecurityTokenProperties properties) {
        this.properties = properties;
    }

    public Optional<SecurityResolvedToken> resolve(HttpServletRequest request) {
        Optional<String> headerToken = extractBearer(request.getHeader(properties.getTokenName()), SecurityTokenSource.HEADER);
        if (headerToken.isPresent()) {
            return headerToken.map(token -> new SecurityResolvedToken(token, SecurityTokenSource.HEADER));
        }
        if (!properties.isQueryTokenEnabled()) {
            return Optional.empty();
        }
        return extractBearer(request.getParameter(properties.getQueryTokenName()), SecurityTokenSource.QUERY)
            .map(token -> new SecurityResolvedToken(token, SecurityTokenSource.QUERY));
    }

    public Optional<SecurityResolvedClientId> resolveClientId(HttpServletRequest request) {
        String headerClientId = request.getHeader(properties.getClientIdHeaderName());
        if (StringUtils.isNotBlank(headerClientId)) {
            return Optional.of(new SecurityResolvedClientId(headerClientId.trim(), SecurityTokenSource.HEADER));
        }
        String queryClientId = request.getParameter(properties.getClientIdQueryName());
        if (StringUtils.isNotBlank(queryClientId)) {
            return Optional.of(new SecurityResolvedClientId(queryClientId.trim(), SecurityTokenSource.QUERY));
        }
        return Optional.empty();
    }

    private Optional<String> extractBearer(String rawValue, SecurityTokenSource source) {
        if (StringUtils.isBlank(rawValue)) {
            return Optional.empty();
        }
        String value = rawValue.trim();
        String prefix = properties.getTokenPrefix();
        if (StringUtils.isBlank(prefix)) {
            return Optional.of(value);
        }
        String expected = prefix.trim();
        String lowerValue = value.toLowerCase(Locale.ROOT);
        String lowerPrefix = expected.toLowerCase(Locale.ROOT);
        if (!lowerValue.startsWith(lowerPrefix)) {
            throw new SecurityAuthenticationException("Unsupported token prefix from " + source.name().toLowerCase(Locale.ROOT));
        }
        if (value.length() == expected.length() || !Character.isWhitespace(value.charAt(expected.length()))) {
            throw new SecurityAuthenticationException("Unsupported token prefix from " + source.name().toLowerCase(Locale.ROOT));
        }
        String token = value.substring(expected.length()).trim();
        if (StringUtils.isBlank(token)) {
            throw new SecurityAuthenticationException("Token value is blank after prefix");
        }
        return Optional.of(token);
    }

}
