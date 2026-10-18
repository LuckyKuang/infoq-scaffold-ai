package cc.infoq.common.mybatis.config;

import cc.infoq.common.mybatis.aspect.DataPermissionPointcutAdvisor;
import cc.infoq.common.mybatis.handler.InjectionMetaObjectHandler;
import cc.infoq.common.mybatis.handler.MybatisExceptionHandler;
import cc.infoq.common.mybatis.handler.PlusPostInitTableInfoHandler;
import cc.infoq.common.mybatis.interceptor.PlusDataPermissionInterceptor;
import cc.infoq.common.utils.SpringUtils;
import com.baomidou.mybatisplus.core.handlers.MetaObjectHandler;
import com.baomidou.mybatisplus.core.handlers.PostInitTableInfoHandler;
import com.baomidou.mybatisplus.core.incrementer.DefaultIdentifierGenerator;
import com.baomidou.mybatisplus.core.incrementer.IdentifierGenerator;
import com.baomidou.mybatisplus.extension.plugins.MybatisPlusInterceptor;
import com.baomidou.mybatisplus.extension.plugins.inner.OptimisticLockerInnerInterceptor;
import com.baomidou.mybatisplus.extension.plugins.inner.PaginationInnerInterceptor;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.context.support.GenericApplicationContext;

import static org.junit.jupiter.api.Assertions.*;

@Tag("dev")
class MybatisPlusConfigTest {

    private final MybatisPlusConfig config = new MybatisPlusConfig();

    @BeforeAll
    static void initSpringContext() {
        GenericApplicationContext context = new GenericApplicationContext();
        context.refresh();
        new SpringUtils().setApplicationContext(context);
    }

    @Test
    void interceptorBeansShouldContainExpectedInnerInterceptors() {
        MybatisPlusInterceptor interceptor = config.mybatisPlusInterceptor();

        assertEquals(3, interceptor.getInterceptors().size());
        assertInstanceOf(PlusDataPermissionInterceptor.class, interceptor.getInterceptors().get(0));
        assertInstanceOf(PaginationInnerInterceptor.class, interceptor.getInterceptors().get(1));
        assertInstanceOf(OptimisticLockerInnerInterceptor.class, interceptor.getInterceptors().get(2));

        PaginationInnerInterceptor pagination = config.paginationInnerInterceptor();
        assertTrue(pagination.isOverflow());
    }

    @Test
    void factoryMethodsShouldCreateExpectedBeanTypes() {
        assertInstanceOf(PlusDataPermissionInterceptor.class, config.dataPermissionInterceptor());
        assertInstanceOf(DataPermissionPointcutAdvisor.class, config.dataPermissionPointcutAdvisor());
        assertInstanceOf(OptimisticLockerInnerInterceptor.class, config.optimisticLockerInnerInterceptor());

        MetaObjectHandler metaObjectHandler = config.metaObjectHandler();
        assertInstanceOf(InjectionMetaObjectHandler.class, metaObjectHandler);

        IdentifierGenerator identifierGenerator = config.idGenerator();
        assertInstanceOf(DefaultIdentifierGenerator.class, identifierGenerator);

        assertInstanceOf(MybatisExceptionHandler.class, config.mybatisExceptionHandler());

        PostInitTableInfoHandler tableInfoHandler = config.postInitTableInfoHandler();
        assertInstanceOf(PlusPostInitTableInfoHandler.class, tableInfoHandler);
    }
}
