package cc.infoq.common.security.auth;

public record SecurityResolvedToken(String token, SecurityTokenSource source) {
}
