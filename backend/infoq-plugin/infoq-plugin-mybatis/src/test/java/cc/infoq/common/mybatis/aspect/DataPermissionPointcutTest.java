package cc.infoq.common.mybatis.aspect;

import cc.infoq.common.mybatis.annotation.DataColumn;
import cc.infoq.common.mybatis.annotation.DataPermission;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.lang.reflect.Proxy;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Tag("dev")
class DataPermissionPointcutTest {

    private final DataPermissionPointcut pointcut = new DataPermissionPointcut();

    @Test
    @DisplayName("matches: should match method-level annotation")
    void matchesShouldMatchMethodAnnotation() throws Exception {
        Method method = MethodAnnotatedMapper.class.getMethod("query");

        assertTrue(pointcut.matches(method, MethodAnnotatedMapper.class));
    }

    @Test
    @DisplayName("matches: should match class-level annotation on jdk proxy target")
    void matchesShouldMatchClassAnnotationOnJdkProxy() throws Exception {
        ClassAnnotatedMapper proxy = (ClassAnnotatedMapper) Proxy.newProxyInstance(
            ClassAnnotatedMapper.class.getClassLoader(),
            new Class[]{ClassAnnotatedMapper.class},
            (p, m, a) -> null
        );
        Method method = ClassAnnotatedMapper.class.getMethod("query");

        assertTrue(pointcut.matches(method, proxy.getClass()));
    }

    @Test
    @DisplayName("matches: should return false when no annotation exists")
    void matchesShouldReturnFalseWhenNoAnnotation() throws Exception {
        Method method = PlainMapper.class.getMethod("query");

        assertFalse(pointcut.matches(method, PlainMapper.class));
    }

    interface MethodAnnotatedMapper {
        @DataPermission({@DataColumn})
        void query();
    }

    @DataPermission({@DataColumn})
    interface ClassAnnotatedMapper {
        void query();
    }

    static class PlainMapper {
        public void query() {
        }
    }
}
