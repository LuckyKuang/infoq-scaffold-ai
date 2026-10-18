package cc.infoq.common.mybatis.aspect;

import cc.infoq.common.mybatis.annotation.DataPermission;
import cc.infoq.common.mybatis.helper.DataPermissionHelper;
import lombok.extern.slf4j.Slf4j;
import org.aopalliance.intercept.MethodInterceptor;
import org.aopalliance.intercept.MethodInvocation;

import java.lang.reflect.Method;
import java.lang.reflect.Proxy;

/**
 * 数据权限注解Advice
 *
 * @author Pontus
 */
@Slf4j
public class DataPermissionAdvice implements MethodInterceptor {

    @Override
    public Object invoke(MethodInvocation invocation) throws Throwable {
        Object target = invocation.getThis();
        Method method = invocation.getMethod();
        Object[] args = invocation.getArguments();
        // 设置权限注解
        DataPermissionHelper.setPermission(getDataPermissionAnnotation(target, method, args));
        try {
            // 执行代理方法
            return invocation.proceed();
        } finally {
            // 清除权限注解
            DataPermissionHelper.removePermission();
            DataPermissionHelper.clearContext();
        }
    }

    /**
     * 获取数据权限注解
     */
    private DataPermission getDataPermissionAnnotation(Object target, Method method,Object[] args){
        DataPermission dataPermission = method.getAnnotation(DataPermission.class);
        // 优先获取方法上的注解
        if (dataPermission != null) {
            return dataPermission;
        }
        // 方法上没有注解，则获取类上的注解
        Class<?> targetClass = target.getClass();
        // 如果是 JDK 动态代理，则获取真实的Class实例
        if (Proxy.isProxyClass(targetClass)) {
            targetClass = targetClass.getInterfaces()[0];
        }
        dataPermission = targetClass.getAnnotation(DataPermission.class);
        return dataPermission;
    }
}
