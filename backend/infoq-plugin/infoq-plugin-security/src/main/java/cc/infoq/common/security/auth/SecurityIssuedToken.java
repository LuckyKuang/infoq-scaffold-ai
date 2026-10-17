package cc.infoq.common.security.auth;

public record SecurityIssuedToken(String accessToken, long expiresIn, String tokenDigest, String jwtId) {
}
