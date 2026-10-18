package cc.infoq.common.mybatis.aspect;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertInstanceOf;

@Tag("dev")
class DataPermissionPointcutAdvisorTest {

    @Test
    @DisplayName("advisor: should expose data permission advice and pointcut")
    void advisorShouldExposeAdviceAndPointcut() {
        DataPermissionPointcutAdvisor advisor = new DataPermissionPointcutAdvisor();

        assertInstanceOf(DataPermissionAdvice.class, advisor.getAdvice());
        assertInstanceOf(DataPermissionPointcut.class, advisor.getPointcut());
    }
}
