package cc.infoq.common.mybatis.aspect;

import cc.infoq.common.mybatis.annotation.DataColumn;
import cc.infoq.common.mybatis.annotation.DataPermission;
import cc.infoq.common.mybatis.helper.DataPermissionHelper;
import org.aopalliance.intercept.MethodInvocation;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;

import java.lang.reflect.Method;
import java.lang.reflect.Proxy;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.*;

@Tag("dev")
class DataPermissionAdviceTest {

    private final DataPermissionAdvice advice = new DataPermissionAdvice();

    @Test
    @DisplayName("invoke: should set and clear method-level data permission")
    void invokeShouldSetAndClearMethodLevelDataPermission() throws Throwable {
        MethodInvocation invocation = mock(MethodInvocation.class);
        Method method = MethodPermissionTarget.class.getMethod("execute");

        when(invocation.getThis()).thenReturn(new MethodPermissionTarget());
        when(invocation.getMethod()).thenReturn(method);
        when(invocation.getArguments()).thenReturn(new Object[0]);
        when(invocation.proceed()).thenReturn("ok");

        try (MockedStatic<DataPermissionHelper> helper = mockStatic(DataPermissionHelper.class)) {
            Object result = advice.invoke(invocation);

            assertEquals("ok", result);
            helper.verify(() -> DataPermissionHelper.setPermission(method.getAnnotation(DataPermission.class)));
            helper.verify(DataPermissionHelper::removePermission);
            helper.verify(DataPermissionHelper::clearContext);
        }
    }

    @Test
    @DisplayName("invoke: should clear permission even when invocation throws")
    void invokeShouldClearPermissionWhenInvocationThrows() throws Throwable {
        MethodInvocation invocation = mock(MethodInvocation.class);
        ClassPermissionApi proxy = (ClassPermissionApi) Proxy.newProxyInstance(
            ClassPermissionApi.class.getClassLoader(),
            new Class[]{ClassPermissionApi.class},
            (p, m, a) -> null
        );
        Method method = ClassPermissionApi.class.getMethod("execute");

        when(invocation.getThis()).thenReturn(proxy);
        when(invocation.getMethod()).thenReturn(method);
        when(invocation.getArguments()).thenReturn(new Object[0]);
        when(invocation.proceed()).thenThrow(new IllegalStateException("boom"));

        try (MockedStatic<DataPermissionHelper> helper = mockStatic(DataPermissionHelper.class)) {
            assertThrows(IllegalStateException.class, () -> advice.invoke(invocation));

            helper.verify(() -> DataPermissionHelper.setPermission(
                ClassPermissionApi.class.getAnnotation(DataPermission.class)));
            helper.verify(DataPermissionHelper::removePermission);
            helper.verify(DataPermissionHelper::clearContext);
        }
    }

    @DataPermission({@DataColumn})
    interface ClassPermissionApi {
        void execute();
    }

    static class MethodPermissionTarget {

        @DataPermission({@DataColumn})
        public void execute() {
        }
    }
}
