package cc.infoq.common.redis.aspectj;

import cc.infoq.common.domain.ApiResult;
import cc.infoq.common.exception.ServiceException;
import cc.infoq.common.redis.annotation.RepeatSubmit;
import cc.infoq.common.redis.utils.RedisUtils;
import cc.infoq.common.utils.ServletUtils;
import cc.infoq.common.utils.SpringUtils;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.aspectj.lang.JoinPoint;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.redisson.api.RedissonClient;
import org.springframework.context.support.GenericApplicationContext;
import org.springframework.http.HttpHeaders;
import org.springframework.validation.BindingResult;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@Tag("dev")
class RepeatSubmitAspectTest {

    private final RepeatSubmitAspect aspect = new RepeatSubmitAspect();

    @Test
    @DisplayName("doBefore: should reject interval lower than 1 second")
    void doBeforeShouldRejectIntervalLowerThanOneSecond() throws Throwable {
        RepeatSubmit repeatSubmit = RepeatSubmitFixtures.class
            .getMethod("tooFast")
            .getAnnotation(RepeatSubmit.class);

        ServiceException ex = assertThrows(ServiceException.class,
            () -> aspect.doBefore(mock(JoinPoint.class), repeatSubmit));

        assertTrue(ex.getMessage().contains("不能小于'1'秒"));
    }

    @Test
    @DisplayName("doBefore/doAfter: should set key and clean up according to result")
    void doBeforeAndAfterShouldHandleCacheLifecycle() throws Throwable {
        prepareJsonUtilsContext();
        RepeatSubmit repeatSubmit = RepeatSubmitFixtures.class
            .getMethod("normal")
            .getAnnotation(RepeatSubmit.class);
        JoinPoint joinPoint = mock(JoinPoint.class);
        when(joinPoint.getArgs()).thenReturn(new Object[]{"payload"});
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn("/api/repeat");
        when(request.getHeader(HttpHeaders.AUTHORIZATION)).thenReturn("Bearer token-1");

        try (MockedStatic<ServletUtils> servletUtils = Mockito.mockStatic(ServletUtils.class);
             MockedStatic<RedisUtils> redisUtils = Mockito.mockStatic(RedisUtils.class)) {
            servletUtils.when(ServletUtils::getRequest).thenReturn(request);
            redisUtils.when(() -> RedisUtils.setObjectIfAbsent(anyString(), eq(""), any())).thenReturn(true);
            redisUtils.when(() -> RedisUtils.deleteObject(anyString())).thenReturn(true);

            aspect.doBefore(joinPoint, repeatSubmit);
            aspect.doAfterReturning(joinPoint, repeatSubmit, ApiResult.ok());
            redisUtils.verify(() -> RedisUtils.deleteObject(anyString()), never());

            aspect.doBefore(joinPoint, repeatSubmit);
            aspect.doAfterReturning(joinPoint, repeatSubmit, ApiResult.fail("bad"));
            redisUtils.verify(() -> RedisUtils.deleteObject(anyString()));
        }
    }

    @Test
    @DisplayName("doBefore: should throw duplicate exception when key already exists")
    void doBeforeShouldThrowWhenKeyAlreadyExists() throws Throwable {
        prepareJsonUtilsContext();
        RepeatSubmit repeatSubmit = RepeatSubmitFixtures.class
            .getMethod("normal")
            .getAnnotation(RepeatSubmit.class);
        JoinPoint joinPoint = mock(JoinPoint.class);
        when(joinPoint.getArgs()).thenReturn(new Object[]{"payload"});
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn("/api/repeat");
        when(request.getHeader(HttpHeaders.AUTHORIZATION)).thenReturn("Bearer token-1");

        try (MockedStatic<ServletUtils> servletUtils = Mockito.mockStatic(ServletUtils.class);
             MockedStatic<RedisUtils> redisUtils = Mockito.mockStatic(RedisUtils.class)) {
            servletUtils.when(ServletUtils::getRequest).thenReturn(request);
            redisUtils.when(() -> RedisUtils.setObjectIfAbsent(anyString(), eq(""), any())).thenReturn(false);

            ServiceException ex = assertThrows(ServiceException.class, () -> aspect.doBefore(joinPoint, repeatSubmit));
            assertTrue(ex.getMessage().contains("duplicated submit"));
        }
    }

    @Test
    @DisplayName("doBefore: should not expose token text in repeat submit key")
    void doBeforeShouldNotExposeTokenTextInRepeatSubmitKey() throws Throwable {
        prepareJsonUtilsContext();
        RepeatSubmit repeatSubmit = RepeatSubmitFixtures.class
            .getMethod("normal")
            .getAnnotation(RepeatSubmit.class);
        JoinPoint joinPoint = mock(JoinPoint.class);
        when(joinPoint.getArgs()).thenReturn(new Object[]{"payload"});
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn("/api/repeat");
        when(request.getHeader(HttpHeaders.AUTHORIZATION)).thenReturn("Bearer token-1");
        List<String> keys = new ArrayList<>();

        try (MockedStatic<ServletUtils> servletUtils = Mockito.mockStatic(ServletUtils.class);
             MockedStatic<RedisUtils> redisUtils = Mockito.mockStatic(RedisUtils.class)) {
            servletUtils.when(ServletUtils::getRequest).thenReturn(request);
            redisUtils.when(() -> RedisUtils.setObjectIfAbsent(anyString(), eq(""), any()))
                .thenAnswer(invocation -> {
                    keys.add(invocation.getArgument(0));
                    return true;
                });

            aspect.doBefore(joinPoint, repeatSubmit);
            aspect.doAfterReturning(joinPoint, repeatSubmit, ApiResult.ok());
        }

        assertEquals(1, keys.size());
        assertFalse(keys.get(0).contains("token-1"));
        assertFalse(keys.get(0).contains("Bearer"));
    }

    @Test
    @DisplayName("doBefore: should isolate anonymous fallback by request source")
    void doBeforeShouldIsolateAnonymousFallbackByRequestSource() throws Throwable {
        prepareJsonUtilsContext();
        RepeatSubmit repeatSubmit = RepeatSubmitFixtures.class
            .getMethod("normal")
            .getAnnotation(RepeatSubmit.class);
        JoinPoint joinPoint = mock(JoinPoint.class);
        when(joinPoint.getArgs()).thenReturn(new Object[]{"payload"});
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn("/api/public-repeat");
        when(request.getHeader(HttpHeaders.USER_AGENT)).thenReturn("JUnit");
        List<String> keys = new ArrayList<>();

        try (MockedStatic<ServletUtils> servletUtils = Mockito.mockStatic(ServletUtils.class);
             MockedStatic<RedisUtils> redisUtils = Mockito.mockStatic(RedisUtils.class)) {
            servletUtils.when(ServletUtils::getRequest).thenReturn(request);
            servletUtils.when(ServletUtils::getClientIP).thenReturn("10.0.0.1", "10.0.0.2");
            redisUtils.when(() -> RedisUtils.setObjectIfAbsent(anyString(), eq(""), any()))
                .thenAnswer(invocation -> {
                    keys.add(invocation.getArgument(0));
                    return true;
                });

            aspect.doBefore(joinPoint, repeatSubmit);
            aspect.doAfterReturning(joinPoint, repeatSubmit, ApiResult.ok());
            aspect.doBefore(joinPoint, repeatSubmit);
            aspect.doAfterReturning(joinPoint, repeatSubmit, ApiResult.ok());
        }

        assertEquals(2, keys.size());
        assertNotEquals(keys.get(0), keys.get(1));
    }

    @Test
    @DisplayName("doAfterThrowing: should remove cache key")
    void doAfterThrowingShouldRemoveCacheKey() throws Throwable {
        prepareJsonUtilsContext();
        RepeatSubmit repeatSubmit = RepeatSubmitFixtures.class
            .getMethod("normal")
            .getAnnotation(RepeatSubmit.class);
        JoinPoint joinPoint = mock(JoinPoint.class);
        when(joinPoint.getArgs()).thenReturn(new Object[]{"payload"});
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn("/api/repeat");
        when(request.getHeader(HttpHeaders.AUTHORIZATION)).thenReturn("Bearer token-1");

        try (MockedStatic<ServletUtils> servletUtils = Mockito.mockStatic(ServletUtils.class);
             MockedStatic<RedisUtils> redisUtils = Mockito.mockStatic(RedisUtils.class)) {
            servletUtils.when(ServletUtils::getRequest).thenReturn(request);
            redisUtils.when(() -> RedisUtils.setObjectIfAbsent(anyString(), eq(""), any())).thenReturn(true);
            redisUtils.when(() -> RedisUtils.deleteObject(anyString())).thenReturn(true);

            aspect.doBefore(joinPoint, repeatSubmit);
            aspect.doAfterThrowing(joinPoint, repeatSubmit, new RuntimeException("boom"));
            redisUtils.verify(() -> RedisUtils.deleteObject(anyString()));
        }
    }

    @Test
    @DisplayName("isFilterObject: should handle servlet, multipart and normal objects")
    void isFilterObjectShouldHandleCommonTypes() {
        MultipartFile file = mock(MultipartFile.class);
        assertTrue(aspect.isFilterObject(mock(HttpServletRequest.class)));
        assertTrue(aspect.isFilterObject(mock(HttpServletResponse.class)));
        assertTrue(aspect.isFilterObject(mock(BindingResult.class)));
        assertTrue(aspect.isFilterObject(file));
        assertTrue(aspect.isFilterObject(new MultipartFile[]{file}));
        assertTrue(aspect.isFilterObject(List.of(file)));
        assertTrue(aspect.isFilterObject(Map.of("f", file)));
        assertFalse(aspect.isFilterObject("plain"));
        assertFalse(aspect.isFilterObject(List.of("a", "b")));
    }

    private static void prepareJsonUtilsContext() {
        GenericApplicationContext context = new GenericApplicationContext();
        context.registerBean(ObjectMapper.class, () -> new ObjectMapper());
        context.registerBean(RedissonClient.class, () -> mock(RedissonClient.class));
        context.refresh();
        new SpringUtils().setApplicationContext(context);
    }

    private static class RepeatSubmitFixtures {

        @RepeatSubmit(interval = 500, timeUnit = TimeUnit.MILLISECONDS, message = "too-fast")
        public void tooFast() {
        }

        @RepeatSubmit(interval = 2, timeUnit = TimeUnit.SECONDS, message = "duplicated submit")
        public void normal() {
        }
    }
}
