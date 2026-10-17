package cc.infoq.common.security.auth;

/**
 * HTTP 异常适配器映射为 401 前使用的显式认证失败
 */
public class SecurityAuthenticationException extends RuntimeException {

    public SecurityAuthenticationException(String message) {
        super(message);
    }

    public SecurityAuthenticationException(String message, Throwable cause) {
        super(message, cause);
    }

}
