package cc.infoq.system.service.impl;

import org.springframework.cache.annotation.Cacheable;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.expression.spel.support.StandardEvaluationContext;

import java.lang.reflect.Method;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 校验 @Cacheable 的 unless 表达式：缓存管理器允许存储 null，必须由 unless 阻止缺失数据被缓存。
 */
final class CacheUnlessAssertions {

    private CacheUnlessAssertions() {
    }

    static void assertSkipsCaching(Class<?> type, String methodName, Class<?> paramType, Object skipped, Object cached) throws Exception {
        Method method = type.getMethod(methodName, paramType);
        Cacheable cacheable = method.getAnnotation(Cacheable.class);
        assertNotNull(cacheable);
        assertTrue(evaluate(cacheable.unless(), skipped), methodName + " must not cache " + skipped);
        assertFalse(evaluate(cacheable.unless(), cached), methodName + " must cache " + cached);
    }

    private static boolean evaluate(String unless, Object result) {
        StandardEvaluationContext context = new StandardEvaluationContext();
        context.setVariable("result", result);
        return Boolean.TRUE.equals(new SpelExpressionParser().parseExpression(unless).getValue(context, Boolean.class));
    }
}
