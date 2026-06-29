package cc.infoq.common.security.config;

/**
 * 安全路由共享常量
 *
 * @author Pontus
 */
public final class SecurityConfig {

    public static final String HEALTH_CHECK_PATH = "/monitor/health";

    public static final String HEALTH_CHECK_PATTERN = HEALTH_CHECK_PATH + "/**";

    private SecurityConfig() {
    }
}
