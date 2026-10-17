package cc.infoq.common.web.config;

import cc.infoq.common.web.handler.GlobalExceptionHandler;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.format.support.DefaultFormattingConversionService;
import org.springframework.web.filter.CorsFilter;
import org.springframework.web.servlet.config.annotation.InterceptorRegistration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;

import java.util.Date;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@Tag("dev")
class ResourcesConfigTest {

    private final ResourcesConfig resourcesConfig = new ResourcesConfig();

    @Test
    @DisplayName("corsFilter/globalExceptionHandler: should create configured web beans")
    void corsFilterAndGlobalExceptionHandlerShouldCreateConfiguredWebBeans() {
        CorsFilter corsFilter = resourcesConfig.corsFilter();
        GlobalExceptionHandler exceptionHandler = resourcesConfig.globalExceptionHandler();

        assertNotNull(corsFilter);
        assertNotNull(exceptionHandler);
    }

    @Test
    @DisplayName("addFormatters: should register string-to-date converter")
    void addFormattersShouldRegisterStringToDateConverter() {
        DefaultFormattingConversionService conversionService = new DefaultFormattingConversionService();

        resourcesConfig.addFormatters(conversionService);
        Date converted = conversionService.convert("2026-03-09 10:11:12", Date.class);

        assertNotNull(converted);
    }

    @Test
    @DisplayName("addInterceptors/addResourceHandlers: should invoke interceptor registration path")
    void addInterceptorsAndAddResourceHandlersShouldBeCallable() {
        InterceptorRegistry interceptorRegistry = Mockito.mock(InterceptorRegistry.class);
        when(interceptorRegistry.addInterceptor(Mockito.any()))
            .thenReturn(Mockito.mock(InterceptorRegistration.class));
        ResourceHandlerRegistry resourceHandlerRegistry = Mockito.mock(ResourceHandlerRegistry.class);

        resourcesConfig.addInterceptors(interceptorRegistry);
        resourcesConfig.addResourceHandlers(resourceHandlerRegistry);

        verify(interceptorRegistry).addInterceptor(argThat(interceptor ->
            interceptor.getClass().getSimpleName().equals("PlusWebInvokeTimeInterceptor")));
    }
}
