package cc.infoq.common.redis.aspectj;

import cc.infoq.common.exception.ServiceException;
import cc.infoq.common.redis.annotation.RateLimiter;
import cc.infoq.common.redis.enums.LimitType;
import cc.infoq.common.redis.utils.RedisUtils;
import cc.infoq.common.utils.ServletUtils;
import cc.infoq.common.utils.SpringUtils;
import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.reflect.MethodSignature;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.redisson.api.RateType;
import org.redisson.api.RedissonClient;
import org.springframework.context.support.GenericApplicationContext;
import org.springframework.mock.web.MockHttpServletRequest;

import java.lang.reflect.Method;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@Tag("dev")
class RateLimiterAspectTest {

    private final RateLimiterAspect aspect = new RateLimiterAspect();

    @BeforeAll
    static void initSpringContext() {
        GenericApplicationContext context = new GenericApplicationContext();
        context.registerBean(RedissonClient.class, () -> Mockito.mock(RedissonClient.class));
        context.refresh();
        new SpringUtils().setApplicationContext(context);
    }

    @Test
    @DisplayName("doBefore: should evaluate SpEL key and apply IP rate limit")
    void doBeforeShouldEvaluateSpelKeyForIpLimit() throws Exception {
        Method method = DemoEndpoint.class.getDeclaredMethod("ipLimited", String.class);
        RateLimiter rateLimiter = method.getAnnotation(RateLimiter.class);
        JoinPoint joinPoint = mockJoinPoint(method, "alice");
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRequestURI("/api/rate/ip");
        String expectedKey = "global:rate_limit:/api/rate/ip:10.10.10.10:alice";

        try (MockedStatic<ServletUtils> servletUtils = Mockito.mockStatic(ServletUtils.class);
             MockedStatic<RedisUtils> redisUtils = Mockito.mockStatic(RedisUtils.class)) {
            servletUtils.when(ServletUtils::getRequest).thenReturn(request);
            servletUtils.when(ServletUtils::getClientIP).thenReturn("10.10.10.10");
            redisUtils.when(() -> RedisUtils.rateLimiter(expectedKey, RateType.OVERALL, 2, 60, 1)).thenReturn(3L);

            aspect.doBefore(joinPoint, rateLimiter);

            redisUtils.verify(() -> RedisUtils.rateLimiter(expectedKey, RateType.OVERALL, 2, 60, 1));
        }
    }

    @Test
    @DisplayName("doBefore: should use cluster client id and PER_CLIENT rate type")
    void doBeforeShouldUseClusterClientId() throws Exception {
        Method method = DemoEndpoint.class.getDeclaredMethod("clusterLimited", String.class);
        RateLimiter rateLimiter = method.getAnnotation(RateLimiter.class);
        JoinPoint joinPoint = mockJoinPoint(method, "job");
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRequestURI("/api/rate/cluster");
        String expectedKey = "global:rate_limit:/api/rate/cluster:node-1:job";
        RedissonClient redissonClient = Mockito.mock(RedissonClient.class);
        when(redissonClient.getId()).thenReturn("node-1");

        try (MockedStatic<ServletUtils> servletUtils = Mockito.mockStatic(ServletUtils.class);
             MockedStatic<RedisUtils> redisUtils = Mockito.mockStatic(RedisUtils.class)) {
            servletUtils.when(ServletUtils::getRequest).thenReturn(request);
            redisUtils.when(RedisUtils::getClient).thenReturn(redissonClient);
            redisUtils.when(() -> RedisUtils.rateLimiter(expectedKey, RateType.PER_CLIENT, 1, 30, 5)).thenReturn(0L);

            aspect.doBefore(joinPoint, rateLimiter);

            redisUtils.verify(() -> RedisUtils.rateLimiter(expectedKey, RateType.PER_CLIENT, 1, 30, 5));
        }
    }

    @Test
    @DisplayName("doBefore: should throw ServiceException with i18n message when permits exhausted")
    void doBeforeShouldThrowServiceExceptionWhenLimited() throws Exception {
        Method method = DemoEndpoint.class.getDeclaredMethod("limited");
        RateLimiter rateLimiter = method.getAnnotation(RateLimiter.class);
        JoinPoint joinPoint = mockJoinPoint(method);
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRequestURI("/api/rate/limited");
        String expectedKey = "global:rate_limit:/api/rate/limited:fixed";

        try (MockedStatic<ServletUtils> servletUtils = Mockito.mockStatic(ServletUtils.class);
             MockedStatic<RedisUtils> redisUtils = Mockito.mockStatic(RedisUtils.class)) {
            servletUtils.when(ServletUtils::getRequest).thenReturn(request);
            redisUtils.when(() -> RedisUtils.rateLimiter(expectedKey, RateType.OVERALL, 1, 1, 1)).thenReturn(-1L);

            ServiceException exception = assertThrows(ServiceException.class, () -> aspect.doBefore(joinPoint, rateLimiter));
            assertEquals("rate.limiter.message", exception.getMessage());
        }
    }

    @Test
    @DisplayName("doBefore: should wrap non-business exceptions as runtime exception")
    void doBeforeShouldWrapUnexpectedException() throws Exception {
        Method method = DemoEndpoint.class.getDeclaredMethod("runtimeBroken");
        RateLimiter rateLimiter = method.getAnnotation(RateLimiter.class);
        JoinPoint joinPoint = mockJoinPoint(method);
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRequestURI("/api/rate/broken");
        String expectedKey = "global:rate_limit:/api/rate/broken:fixed";

        try (MockedStatic<ServletUtils> servletUtils = Mockito.mockStatic(ServletUtils.class);
             MockedStatic<RedisUtils> redisUtils = Mockito.mockStatic(RedisUtils.class)) {
            servletUtils.when(ServletUtils::getRequest).thenReturn(request);
            redisUtils.when(() -> RedisUtils.rateLimiter(expectedKey, RateType.OVERALL, 1, 1, 1))
                .thenThrow(new IllegalStateException("redis down"));

            RuntimeException exception = assertThrows(RuntimeException.class, () -> aspect.doBefore(joinPoint, rateLimiter));
            assertEquals("服务器限流异常，请稍候再试", exception.getMessage());
            assertInstanceOf(IllegalStateException.class, exception.getCause());
        }
    }

    private static JoinPoint mockJoinPoint(Method method, Object... args) {
        MethodSignature signature = Mockito.mock(MethodSignature.class);
        when(signature.getMethod()).thenReturn(method);
        JoinPoint point = Mockito.mock(JoinPoint.class);
        when(point.getSignature()).thenReturn(signature);
        when(point.getArgs()).thenReturn(args);
        return point;
    }

    private static class DemoEndpoint {

        @RateLimiter(key = "#{#name}", limitType = LimitType.IP, count = 2, time = 60, timeout = 1)
        public void ipLimited(String name) {
        }

        @RateLimiter(key = "#name", limitType = LimitType.CLUSTER, count = 1, time = 30, timeout = 5)
        public void clusterLimited(String name) {
        }

        @RateLimiter(key = "fixed", count = 1, time = 1, timeout = 1, message = "{rate.limiter.message}")
        public void limited() {
        }

        @RateLimiter(key = "fixed", count = 1, time = 1, timeout = 1)
        public void runtimeBroken() {
        }
    }
}
