package cc.infoq.common.security.auth;

public record SecurityResolvedClientId(String clientId, SecurityTokenSource source) {
}
