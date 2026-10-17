package cc.infoq.common.mybatis.aspect;

import org.aopalliance.aop.Advice;
import org.springframework.aop.Pointcut;
import org.springframework.aop.support.AbstractPointcutAdvisor;

/**
 * 数据权限注解切面定义
 *
 * @author Pontus
 */
public class DataPermissionPointcutAdvisor extends AbstractPointcutAdvisor {

    private final Advice advice;
    private final Pointcut pointcut;

    public DataPermissionPointcutAdvisor() {
        this.advice = new DataPermissionAdvice();
        this.pointcut = new DataPermissionPointcut();
    }

    @Override
    public Pointcut getPointcut() {
        return this.pointcut;
    }

    @Override
    public Advice getAdvice() {
        return this.advice;
    }

}
