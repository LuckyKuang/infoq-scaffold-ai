package cc.infoq.common.mybatis.helper;

import cc.infoq.common.mybatis.annotation.DataPermission;
import cc.infoq.common.utils.reflect.ReflectUtils;
import cn.hutool.core.collection.CollectionUtil;
import cn.hutool.core.util.ObjectUtil;
import com.baomidou.mybatisplus.core.plugins.IgnoreStrategy;
import com.baomidou.mybatisplus.core.plugins.InterceptorIgnoreHelper;
import lombok.AccessLevel;
import lombok.NoArgsConstructor;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;

import java.util.HashMap;
import java.util.Map;
import java.util.Stack;
import java.util.function.Supplier;

/**
 * 数据权限助手
 *
 * @author Pontus
 */
@NoArgsConstructor(access = AccessLevel.PRIVATE)
public class DataPermissionHelper {

    private static final String DATA_PERMISSION_KEY = "data:permission";

    private static final ThreadLocal<Stack<Integer>> REENTRANT_IGNORE = ThreadLocal.withInitial(Stack::new);

    private static final ThreadLocal<DataPermission> PERMISSION_CACHE = new ThreadLocal<>();

    private static final ThreadLocal<ContextMap> THREAD_LOCAL_CONTEXT = new ThreadLocal<>();

    /**
     * 防止外部 Map 污染
     */
    private static final class ContextMap extends HashMap<String, Object> {
    }

    /**
     * 获取当前执行mapper权限注解
     *
     * @return 返回当前执行mapper权限注解
     */
    public static DataPermission getPermission() {
        return PERMISSION_CACHE.get();
    }

    /**
     * 设置当前执行mapper权限注解
     *
     * @param dataPermission   数据权限注解
     */
    public static void setPermission(DataPermission dataPermission) {
        PERMISSION_CACHE.set(dataPermission);
    }

    /**
     * 删除当前执行mapper权限注解
     */
    public static void removePermission() {
        PERMISSION_CACHE.remove();
    }

    /**
     * 从上下文中获取指定键的变量值，并将其转换为指定的类型
     *
     * @param key  变量的键
     * @param type 变量值的类型
     * @param <T>  变量值的类型
     * @return 指定键的变量值，如果不存在则返回 null
     */
    public static <T> T getVariable(String key, Class<T> type) {
        Map<String, Object> context = getContext();
        Object value = context.get(key);
        if (ObjectUtil.isNull(value)) {
            return null;
        }
        return type.cast(value);
    }

    /**
     * 向上下文中设置指定键的变量值
     *
     * @param key   要设置的变量的键
     * @param value 要设置的变量值
     */
    public static void setVariable(String key, Object value) {
        Map<String, Object> context = getContext();
        context.put(key, value);
    }

    /**
     * 获取数据权限上下文
     *
     * @return request scope 或非 Web 线程隔离上下文中的 Map 对象，用于存储数据权限相关的上下文信息
     * @throws NullPointerException 如果数据权限上下文类型异常，则抛出NullPointerException
     */
    public static Map<String, Object> getContext() {
        RequestAttributes requestAttributes = RequestContextHolder.getRequestAttributes();
        if (requestAttributes == null) {
            return getThreadLocalContext();
        }
        Object attribute = requestAttributes.getAttribute(DATA_PERMISSION_KEY, RequestAttributes.SCOPE_REQUEST);
        ContextMap context = toContextMap(attribute);
        if (attribute != context) {
            requestAttributes.setAttribute(DATA_PERMISSION_KEY, context, RequestAttributes.SCOPE_REQUEST);
        }
        return context;
    }

    private static ContextMap getThreadLocalContext() {
        ContextMap context = THREAD_LOCAL_CONTEXT.get();
        if (context == null) {
            context = new ContextMap();
            THREAD_LOCAL_CONTEXT.set(context);
        }
        return context;
    }

    private static ContextMap toContextMap(Object attribute) {
        if (ObjectUtil.isNull(attribute)) {
            return new ContextMap();
        }
        if (attribute instanceof ContextMap context) {
            return context;
        }
        if (attribute instanceof Map<?, ?> map) {
            ContextMap context = new ContextMap();
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                if (!(entry.getKey() instanceof String key)) {
                    throw new NullPointerException("data permission context key type exception");
                }
                context.put(key, entry.getValue());
            }
            return context;
        }
        throw new NullPointerException("data permission context type exception");
    }

    public static void clearContext() {
        RequestAttributes requestAttributes = RequestContextHolder.getRequestAttributes();
        if (requestAttributes != null) {
            requestAttributes.removeAttribute(DATA_PERMISSION_KEY, RequestAttributes.SCOPE_REQUEST);
        }
        THREAD_LOCAL_CONTEXT.remove();
    }

    private static IgnoreStrategy getIgnoreStrategy() {
        Object ignoreStrategyLocal = ReflectUtils.getStaticFieldValue(ReflectUtils.getField(InterceptorIgnoreHelper.class, "IGNORE_STRATEGY_LOCAL"));
        if (ignoreStrategyLocal instanceof ThreadLocal<?> IGNORE_STRATEGY_LOCAL) {
            if (IGNORE_STRATEGY_LOCAL.get() instanceof IgnoreStrategy ignoreStrategy) {
                return ignoreStrategy;
            }
        }
        return null;
    }

    /**
     * 开启忽略数据权限(开启后需手动调用 {@link #disableIgnore()} 关闭)
     */
    private static void enableIgnore() {
        IgnoreStrategy ignoreStrategy = getIgnoreStrategy();
        if (ObjectUtil.isNull(ignoreStrategy)) {
            InterceptorIgnoreHelper.handle(IgnoreStrategy.builder().dataPermission(true).build());
        } else {
            ignoreStrategy.setDataPermission(true);
        }
        Stack<Integer> reentrantStack = REENTRANT_IGNORE.get();
        reentrantStack.push(reentrantStack.size() + 1);
    }

    /**
     * 关闭忽略数据权限
     */
    private static void disableIgnore() {
        IgnoreStrategy ignoreStrategy = getIgnoreStrategy();
        if (ObjectUtil.isNotNull(ignoreStrategy)) {
            boolean noOtherIgnoreStrategy = !Boolean.TRUE.equals(ignoreStrategy.getDynamicTableName())
                && !Boolean.TRUE.equals(ignoreStrategy.getBlockAttack())
                && !Boolean.TRUE.equals(ignoreStrategy.getIllegalSql())
                && CollectionUtil.isEmpty(ignoreStrategy.getOthers());
            Stack<Integer> reentrantStack = REENTRANT_IGNORE.get();
            boolean empty = reentrantStack.isEmpty() || reentrantStack.pop() == 1;
            if (noOtherIgnoreStrategy && empty) {
                InterceptorIgnoreHelper.clearIgnoreStrategy();
            } else if (empty) {
                ignoreStrategy.setDataPermission(false);
            }

        }
    }

    /**
     * 在忽略数据权限中执行
     *
     * @param handle 处理执行方法
     */
    public static void ignore(Runnable handle) {
        enableIgnore();
        try {
            handle.run();
        } finally {
            disableIgnore();
        }
    }

    /**
     * 在忽略数据权限中执行
     *
     * @param handle 处理执行方法
     */
    public static <T> T ignore(Supplier<T> handle) {
        enableIgnore();
        try {
            return handle.get();
        } finally {
            disableIgnore();
        }
    }

}
