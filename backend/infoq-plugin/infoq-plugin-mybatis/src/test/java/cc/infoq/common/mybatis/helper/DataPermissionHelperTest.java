package cc.infoq.common.mybatis.helper;

import cc.infoq.common.mybatis.annotation.DataPermission;
import com.baomidou.mybatisplus.core.plugins.IgnoreStrategy;
import com.baomidou.mybatisplus.core.plugins.InterceptorIgnoreHelper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.lang.reflect.Field;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

@Tag("dev")
class DataPermissionHelperTest {

    private static final String DATA_PERMISSION_KEY = "data:permission";

    @AfterEach
    void tearDown() {
        DataPermissionHelper.removePermission();
        DataPermissionHelper.clearContext();
        RequestContextHolder.resetRequestAttributes();
        InterceptorIgnoreHelper.clearIgnoreStrategy();
    }

    @Test
    void permissionCacheShouldSupportSetGetAndRemove() {
        DataPermission permission = mock(DataPermission.class);

        DataPermissionHelper.setPermission(permission);
        assertSame(permission, DataPermissionHelper.getPermission());

        DataPermissionHelper.removePermission();
        assertNull(DataPermissionHelper.getPermission());
    }

    @Test
    void contextAndVariablesShouldBeStoredInRequestAttributes() {
        ServletRequestAttributes attributes = bindRequestAttributes();

        Map<String, Object> context = DataPermissionHelper.getContext();
        assertNotNull(context);
        assertTrue(context.isEmpty());

        DataPermissionHelper.setVariable("deptId", 10L);

        assertEquals(10L, DataPermissionHelper.getVariable("deptId", Long.class));
        assertSame(context, attributes.getAttribute(DATA_PERMISSION_KEY, RequestAttributes.SCOPE_REQUEST));
    }

    @Test
    void contextShouldUseThreadLocalFallbackWithoutRequestAttributes() throws InterruptedException {
        DataPermissionHelper.setVariable("deptId", 10L);
        assertEquals(10L, DataPermissionHelper.getVariable("deptId", Long.class));

        AtomicReference<Long> valueFromOtherThread = new AtomicReference<>(-1L);
        Thread thread = new Thread(() -> valueFromOtherThread.set(DataPermissionHelper.getVariable("deptId", Long.class)));
        thread.start();
        thread.join();

        assertNull(valueFromOtherThread.get());
    }

    @Test
    void requestContextShouldNotReuseExistingThreadLocalFallbackContext() {
        DataPermissionHelper.setVariable("source", "thread-local");
        ServletRequestAttributes attributes = bindRequestAttributes();

        assertNull(DataPermissionHelper.getVariable("source", String.class));
        DataPermissionHelper.setVariable("source", "request");

        assertEquals("request", DataPermissionHelper.getVariable("source", String.class));
        assertEquals("request", DataPermissionHelper.getContext().get("source"));
        assertSame(DataPermissionHelper.getContext(), attributes.getAttribute(DATA_PERMISSION_KEY, RequestAttributes.SCOPE_REQUEST));

        RequestContextHolder.resetRequestAttributes();
        assertEquals("thread-local", DataPermissionHelper.getVariable("source", String.class));
    }

    @Test
    void clearContextShouldClearThreadLocalFallbackAndRequestAttribute() {
        DataPermissionHelper.setVariable("threadOnly", "thread-local");
        ServletRequestAttributes attributes = bindRequestAttributes();
        DataPermissionHelper.setVariable("requestOnly", "request");

        DataPermissionHelper.clearContext();

        assertNull(attributes.getAttribute(DATA_PERMISSION_KEY, RequestAttributes.SCOPE_REQUEST));
        RequestContextHolder.resetRequestAttributes();
        assertNull(DataPermissionHelper.getVariable("threadOnly", String.class));
    }

    @Test
    void getContextShouldConvertPlainMapAttributeToContextMap() {
        ServletRequestAttributes attributes = bindRequestAttributes();
        Map<String, Object> original = new HashMap<>();
        original.put("deptId", 10L);
        attributes.setAttribute(DATA_PERMISSION_KEY, original, RequestAttributes.SCOPE_REQUEST);

        Map<String, Object> context = DataPermissionHelper.getContext();

        assertEquals(10L, context.get("deptId"));
        assertNotSame(original, context);
        assertSame(context, attributes.getAttribute(DATA_PERMISSION_KEY, RequestAttributes.SCOPE_REQUEST));
    }

    @Test
    void getContextShouldThrowWhenAttributeTypeIsInvalid() {
        ServletRequestAttributes attributes = bindRequestAttributes();
        attributes.setAttribute(DATA_PERMISSION_KEY, "invalid", RequestAttributes.SCOPE_REQUEST);

        assertThrows(NullPointerException.class, DataPermissionHelper::getContext);
    }

    @Test
    void getContextShouldThrowWhenMapKeyTypeIsInvalid() {
        ServletRequestAttributes attributes = bindRequestAttributes();
        Map<Object, Object> original = new HashMap<>();
        original.put(100L, "deptId");
        attributes.setAttribute(DATA_PERMISSION_KEY, original, RequestAttributes.SCOPE_REQUEST);

        assertThrows(NullPointerException.class, DataPermissionHelper::getContext);
    }

    @Test
    void getVariableShouldThrowWhenValueTypeDoesNotMatch() {
        DataPermissionHelper.setVariable("deptId", 10L);

        assertThrows(ClassCastException.class, () -> DataPermissionHelper.getVariable("deptId", String.class));
    }

    @Test
    void ignoreRunnableShouldClearStrategyWhenNoOtherIgnoreFlagsExist() {
        AtomicBoolean executed = new AtomicBoolean(false);

        DataPermissionHelper.ignore(() -> executed.set(true));

        assertTrue(executed.get());
        assertNull(currentIgnoreStrategy());
    }

    @Test
    void ignoreSupplierShouldKeepExistingStrategyAndResetDataPermissionOnly() {
        InterceptorIgnoreHelper.handle(IgnoreStrategy.builder().dynamicTableName(true).build());

        String result = DataPermissionHelper.ignore(() -> "ok");

        assertEquals("ok", result);
        IgnoreStrategy strategy = currentIgnoreStrategy();
        assertNotNull(strategy);
        assertEquals(Boolean.TRUE, strategy.getDynamicTableName());
        assertEquals(Boolean.FALSE, strategy.getDataPermission());
    }

    @Test
    void nestedIgnoreShouldPreserveInnerStateUntilOuterFinishes() {
        AtomicBoolean innerExecuted = new AtomicBoolean(false);
        AtomicReference<Boolean> dataPermissionInsideOuter = new AtomicReference<>();

        DataPermissionHelper.ignore(() -> {
            DataPermissionHelper.ignore(() -> innerExecuted.set(true));
            IgnoreStrategy current = currentIgnoreStrategy();
            dataPermissionInsideOuter.set(current == null ? null : current.getDataPermission());
        });

        assertTrue(innerExecuted.get());
        assertEquals(Boolean.TRUE, dataPermissionInsideOuter.get());
        assertNull(currentIgnoreStrategy());
    }

    @Test
    void nestedIgnoreShouldKeepStrategyWhenOuterAlsoHasOtherIgnoreFlags() {
        InterceptorIgnoreHelper.handle(IgnoreStrategy.builder().illegalSql(true).build());
        AtomicReference<Boolean> dataPermissionAfterInner = new AtomicReference<>();

        DataPermissionHelper.ignore(() -> {
            DataPermissionHelper.ignore(() -> assertTrue(Boolean.TRUE.equals(currentIgnoreStrategy().getDataPermission())));
            dataPermissionAfterInner.set(currentIgnoreStrategy().getDataPermission());
        });

        IgnoreStrategy strategy = currentIgnoreStrategy();
        assertEquals(Boolean.TRUE, dataPermissionAfterInner.get());
        assertNotNull(strategy);
        assertEquals(Boolean.TRUE, strategy.getIllegalSql());
        assertFalse(Boolean.TRUE.equals(strategy.getDataPermission()));
    }

    private static ServletRequestAttributes bindRequestAttributes() {
        ServletRequestAttributes attributes = new ServletRequestAttributes(new MockHttpServletRequest());
        RequestContextHolder.setRequestAttributes(attributes);
        return attributes;
    }

    private static IgnoreStrategy currentIgnoreStrategy() {
        try {
            Field field = InterceptorIgnoreHelper.class.getDeclaredField("IGNORE_STRATEGY_LOCAL");
            field.setAccessible(true);
            Object localObject = field.get(null);
            if (!(localObject instanceof ThreadLocal<?> local)) {
                throw new IllegalStateException("Unexpected ignore strategy holder type: " + localObject);
            }
            Object strategyObject = local.get();
            if (strategyObject == null) {
                return null;
            }
            if (!(strategyObject instanceof IgnoreStrategy strategy)) {
                throw new IllegalStateException("Unexpected ignore strategy type: " + strategyObject.getClass());
            }
            return strategy;
        } catch (NoSuchFieldException | IllegalAccessException e) {
            throw new IllegalStateException("Unable to read ignore strategy", e);
        }
    }
}
