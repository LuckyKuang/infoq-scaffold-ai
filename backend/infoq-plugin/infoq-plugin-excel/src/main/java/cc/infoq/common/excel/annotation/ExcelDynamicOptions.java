package cc.infoq.common.excel.annotation;

import cc.infoq.common.excel.core.ExcelOptionsProvider;

import java.lang.annotation.*;

/**
 * Excel动态下拉选项注解
 * @author Pontus
 */
@Target({ElementType.FIELD})
@Retention(RetentionPolicy.RUNTIME)
@Inherited
public @interface ExcelDynamicOptions {

    /**
     * 提供者类全限定名
     * <p>
     * {@link ExcelOptionsProvider} 接口实现类 class
     */
    Class<? extends ExcelOptionsProvider> providerClass();
}
