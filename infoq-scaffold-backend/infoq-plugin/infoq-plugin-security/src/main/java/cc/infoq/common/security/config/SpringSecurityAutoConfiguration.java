package cc.infoq.common.security.config;

import cc.infoq.common.security.auth.*;
import cc.infoq.common.security.config.properties.SecurityProperties;
import cc.infoq.common.security.filter.SecurityTokenAuthenticationFilter;
import cc.infoq.common.security.handler.SecurityAccessDeniedHandler;
import cc.infoq.common.security.handler.SecurityAuthenticationEntryPoint;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.core.env.Environment;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Spring Security 引导配置
 */
@AutoConfiguration(before = SecurityAutoConfiguration.class)
@EnableWebSecurity
@EnableMethodSecurity
@EnableConfigurationProperties({SecurityProperties.class, SecurityTokenProperties.class})
public class SpringSecurityAutoConfiguration {

    static final String STRICT_AUTHENTICATION_PROPERTY = "security.spring-security.strict-authentication";

    private static final List<String> DEFAULT_PUBLIC_MATCHERS = List.of(
        "/",
        "/auth/code",
        "/auth/login",
        "/auth/register",
        "/auth/forgot-password",
        "/auth/invite/code/check",
        "/auth/oauth/**",
        "/auth/email/code",
        "/resource/email/code",
        SecurityConfig.HEALTH_CHECK_PATH,
        SecurityConfig.HEALTH_CHECK_PATTERN,
        "/doc.html",
        "/webjars/**",
        "/swagger-ui.html",
        "/swagger-ui/**",
        "/v3/api-docs",
        "/v3/api-docs/**",
        "/static/**"
    );

    @Bean
    @ConditionalOnMissingBean
    public SecurityAuthenticationEntryPoint securityAuthenticationEntryPoint(ObjectMapper objectMapper) {
        return new SecurityAuthenticationEntryPoint(objectMapper);
    }

    @Bean
    @ConditionalOnMissingBean
    public SecurityAccessDeniedHandler securityAccessDeniedHandler(ObjectMapper objectMapper) {
        return new SecurityAccessDeniedHandler(objectMapper);
    }

    @Bean
    @ConditionalOnMissingBean
    public SecurityTokenResolver securityTokenResolver(SecurityTokenProperties tokenProperties) {
        return new SecurityTokenResolver(tokenProperties);
    }

    @Bean
    @ConditionalOnMissingBean
    public SecurityTokenStore securityTokenStore() {
        return new SecurityTokenStore();
    }

    @Bean
    @ConditionalOnMissingBean
    public SecurityTokenService securityTokenService(SecurityTokenProperties tokenProperties,
                                                     SecurityTokenStore tokenStore) {
        return new SecurityTokenService(tokenProperties, tokenStore);
    }

    @Bean
    @ConditionalOnMissingBean
    public CurrentUserService currentUserService() {
        return new CurrentUserService();
    }

    @Bean
    @ConditionalOnMissingBean
    public SecurityTokenAuthenticationFilter securityTokenAuthenticationFilter(SecurityTokenResolver tokenResolver,
                                                                               SecurityTokenService tokenService,
                                                                               SecurityAuthenticationEntryPoint authenticationEntryPoint) {
        return new SecurityTokenAuthenticationFilter(tokenResolver, tokenService, authenticationEntryPoint);
    }

    @Bean
    @ConditionalOnMissingBean(SecurityFilterChain.class)
    public SecurityFilterChain securityFilterChain(HttpSecurity http,
                                                   SecurityAuthenticationEntryPoint authenticationEntryPoint,
                                                   SecurityAccessDeniedHandler accessDeniedHandler,
                                                   SecurityProperties securityProperties,
                                                   ObjectProvider<SecurityTokenAuthenticationFilter> tokenAuthenticationFilter,
                                                   Environment environment) throws Exception {
        List<String> publicMatchers = resolvePublicMatchers(securityProperties);
        boolean strictAuthentication = isStrictAuthentication(environment);
        http
            .csrf(AbstractHttpConfigurer::disable)
            .httpBasic(AbstractHttpConfigurer::disable)
            .formLogin(AbstractHttpConfigurer::disable)
            .logout(AbstractHttpConfigurer::disable)
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .exceptionHandling(exception -> exception
                .authenticationEntryPoint(authenticationEntryPoint)
                .accessDeniedHandler(accessDeniedHandler))
            .authorizeHttpRequests(authorize -> {
                if (!publicMatchers.isEmpty()) {
                    authorize.requestMatchers(publicMatchers.toArray(String[]::new)).permitAll();
                }
                if (strictAuthentication) {
                    authorize.anyRequest().authenticated();
                } else {
                    authorize.anyRequest().permitAll();
                }
            });
        if (strictAuthentication) {
            http.addFilterBefore(tokenAuthenticationFilter.getObject(), UsernamePasswordAuthenticationFilter.class);
        }
        return http.build();
    }

    static List<String> resolvePublicMatchers(SecurityProperties securityProperties) {
        Set<String> matchers = new LinkedHashSet<>();
        if (securityProperties != null && securityProperties.getExcludes() != null) {
            for (String exclude : securityProperties.getExcludes()) {
                if (exclude != null && !exclude.isBlank()) {
                    matchers.add(exclude);
                }
            }
        }
        matchers.addAll(DEFAULT_PUBLIC_MATCHERS);
        return new ArrayList<>(matchers);
    }

    static boolean isStrictAuthentication(Environment environment) {
        return environment.getProperty(STRICT_AUTHENTICATION_PROPERTY, Boolean.class, true);
    }
}
