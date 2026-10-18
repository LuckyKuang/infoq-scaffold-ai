package cc.infoq.common.web.config;

import cc.infoq.common.utils.ObjectUtils;
import cc.infoq.common.web.handler.GlobalExceptionHandler;
import cc.infoq.common.web.interceptor.PlusWebInvokeTimeInterceptor;
import cn.hutool.core.date.DateTime;
import cn.hutool.core.date.DateUtil;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.core.Ordered;
import org.springframework.context.annotation.Bean;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.format.FormatterRegistry;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;
import org.springframework.web.cors.DefaultCorsProcessor;
import cc.infoq.common.domain.ApiResult;
import tools.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.Date;
import lombok.extern.slf4j.Slf4j;

/**
 * 通用配置
 *
 * @author Pontus
 */
@AutoConfiguration
@Slf4j
public class ResourcesConfig implements WebMvcConfigurer {

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        // 全局访问性能拦截
        registry.addInterceptor(new PlusWebInvokeTimeInterceptor());
    }

    @Override
    public void addFormatters(FormatterRegistry registry) {
        // 全局日期格式转换配置
        registry.addConverter(String.class, Date.class, source -> {
            DateTime parse = DateUtil.parse(source);
            if (ObjectUtils.isNull(parse)) {
                return null;
            }
            return parse.toJdkDate();
        });
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
    }

    /**
     * 跨域配置
     */
    @Bean
    public CorsFilter corsFilter(@Qualifier("browserSessionCorsConfiguration") ObjectProvider<CorsConfiguration> browserSessionCors,
                                 ObjectMapper objectMapper) {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowCredentials(true);
        // 设置访问源地址
        config.addAllowedOriginPattern("*");
        // 设置访问源请求头
        config.addAllowedHeader("*");
        // 设置访问源请求方法
        config.addAllowedMethod("*");
        // 有效期 1800秒
        config.setMaxAge(1800L);
        // 添加映射路径，拦截一切请求
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        CorsConfiguration browserConfig = browserSessionCors.getIfAvailable();
        if (browserConfig != null) {
            source.registerCorsConfiguration("/auth/browser-session", browserConfig);
            source.registerCorsConfiguration("/auth/browser-session/**", browserConfig);
        }
        source.registerCorsConfiguration("/**", config);
        // 返回新的CorsFilter
        CorsFilter filter = new CorsFilter(source) {
            @Override
            protected void doFilterInternal(jakarta.servlet.http.HttpServletRequest request,
                                            jakarta.servlet.http.HttpServletResponse response,
                                            jakarta.servlet.FilterChain chain) throws jakarta.servlet.ServletException, IOException {
                if (request.getServletPath().equals("/auth/browser-session") || request.getServletPath().startsWith("/auth/browser-session/")) {
                    response.setHeader("Cache-Control", "no-store");
                    response.setHeader("Pragma", "no-cache");
                }
                super.doFilterInternal(request, response, chain);
            }
        };
        filter.setCorsProcessor(new DefaultCorsProcessor() {
            @Override
            public boolean processRequest(CorsConfiguration configuration,
                                          jakarta.servlet.http.HttpServletRequest request,
                                          jakarta.servlet.http.HttpServletResponse response) throws IOException {
                boolean accepted = super.processRequest(configuration, request, response);
                if (!accepted && (request.getServletPath().equals("/auth/browser-session")
                    || request.getServletPath().startsWith("/auth/browser-session/"))) {
                    String clientId = request.getHeader("clientid");
                    log.info("browser_session action={} category=origin_rejected clientId={} requestId={}",
                        request.getMethod(), clientId != null && clientId.matches("[A-Za-z0-9][A-Za-z0-9._-]{0,127}") ? clientId : "invalid",
                        request.getRequestId());
                }
                return accepted;
            }

            @Override
            protected void rejectRequest(ServerHttpResponse response) throws IOException {
                response.setStatusCode(HttpStatus.FORBIDDEN);
                response.getHeaders().setCacheControl("no-store");
                response.getHeaders().setPragma("no-cache");
                response.getHeaders().setContentType(org.springframework.http.MediaType.APPLICATION_JSON);
                response.getBody().write(objectMapper.writeValueAsString(ApiResult.fail(403, "origin_rejected"))
                    .getBytes(StandardCharsets.UTF_8));
                response.flush();
            }
        });
        return filter;
    }

    @Bean
    public FilterRegistrationBean<CorsFilter> corsFilterRegistration(CorsFilter corsFilter) {
        FilterRegistrationBean<CorsFilter> registration = new FilterRegistrationBean<>(corsFilter);
        registration.setOrder(Ordered.HIGHEST_PRECEDENCE);
        return registration;
    }

    /**
     * 全局异常处理器
     */
    @Bean
    public GlobalExceptionHandler globalExceptionHandler() {
        return new GlobalExceptionHandler();
    }
}
