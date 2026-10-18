package cc.infoq.common.security.config;

import cc.infoq.common.security.auth.*;
import cc.infoq.common.security.browser.*;
import cc.infoq.common.security.config.properties.SecurityProperties;
import cc.infoq.common.security.config.properties.SseProperties;
import cc.infoq.common.security.filter.SecurityTokenAuthenticationFilter;
import cc.infoq.common.security.handler.SecurityAccessDeniedHandler;
import cc.infoq.common.security.handler.SecurityAuthenticationEntryPoint;
import tools.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.csrf.CsrfFilter;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.web.cors.CorsConfiguration;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Spring Security 引导配置
 */
@AutoConfiguration
@EnableWebSecurity
@EnableMethodSecurity
@EnableConfigurationProperties({SecurityProperties.class, SecurityTokenProperties.class, SseProperties.class, BrowserSessionProperties.class})
public class SpringSecurityAutoConfiguration {

    static final String STRICT_AUTHENTICATION_PROPERTY = "security.spring-security.strict-authentication";

    private static final String DEFAULT_SSE_PATH = "/resource/sse";

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
    public SecurityAuthenticationEntryPoint securityAuthenticationEntryPoint(ObjectMapper objectMapper, BrowserSessionCookies cookies) {
        return new SecurityAuthenticationEntryPoint(objectMapper, cookies);
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
    public BrowserSessionStore browserSessionStore() {
        return new BrowserSessionStore();
    }

    @Bean
    public BrowserSessionService browserSessionService(BrowserSessionProperties properties, BrowserSessionStore store,
                                                       SecurityTokenStore tokenStore, SecurityTokenService tokenService) {
        return new BrowserSessionService(properties, store, tokenStore, tokenService);
    }

    @Bean
    public BrowserSessionCookies browserSessionCookies(BrowserSessionProperties properties) {
        return new BrowserSessionCookies(properties);
    }

    @Bean
    public BrowserSessionCsrfRepository browserSessionCsrfRepository(BrowserSessionProperties properties) {
        return new BrowserSessionCsrfRepository(properties);
    }

    @Bean
    public CorsConfiguration browserSessionCorsConfiguration(BrowserSessionProperties properties) {
        CorsConfiguration cors = new CorsConfiguration() {
            @Override
            public String checkOrigin(String origin) {
                if (origin == null) {
                    return null;
                }
                try {
                    return properties.getAllowedOrigins().contains(BrowserSessionProperties.normalizeOrigin(origin)) ? origin : null;
                } catch (IllegalArgumentException exception) {
                    return null;
                }
            }
        };
        cors.setAllowedOrigins(List.copyOf(properties.getAllowedOrigins()));
        cors.setAllowedMethods(List.of("GET", "PUT", "POST", "DELETE", "OPTIONS"));
        cors.setAllowedHeaders(List.of("Content-Type", "Authorization", "clientid", BrowserSessionCookies.SCOPE_HEADER, "X-XSRF-TOKEN"));
        cors.setAllowCredentials(true);
        cors.setMaxAge(600L);
        return cors;
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
                                                   SseProperties sseProperties,
                                                   ObjectProvider<SecurityTokenAuthenticationFilter> tokenAuthenticationFilter,
                                                   BrowserSessionProperties browserProperties,
                                                   BrowserSessionCookies browserCookies,
                                                   BrowserSessionCsrfRepository browserCsrf,
                                                   ObjectMapper objectMapper,
                                                   Environment environment) throws Exception {
        List<String> publicMatchers = resolvePublicMatchers(securityProperties, sseProperties);
        boolean strictAuthentication = isStrictAuthentication(environment);
        http
            .csrf(csrf -> csrf.csrfTokenRepository(browserCsrf)
                // A stateless Bearer request is not a browser login event; keep CSRF stable until explicit DELETE.
                .sessionAuthenticationStrategy(new org.springframework.security.web.authentication.session.NullAuthenticatedSessionStrategy())
                .csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler() {
                    @Override
                    public String resolveCsrfTokenValue(jakarta.servlet.http.HttpServletRequest request,
                                                        org.springframework.security.web.csrf.CsrfToken token) {
                        return request.getHeader(token.getHeaderName());
                    }
                })
                .requireCsrfProtectionMatcher(request -> BrowserSessionGuardFilter.isResource(request)
                    && !Set.of("GET", "HEAD", "OPTIONS", "TRACE").contains(request.getMethod())))
            .httpBasic(AbstractHttpConfigurer::disable)
            .formLogin(AbstractHttpConfigurer::disable)
            .logout(AbstractHttpConfigurer::disable)
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .exceptionHandling(exception -> exception
                .authenticationEntryPoint(authenticationEntryPoint)
                .accessDeniedHandler(accessDeniedHandler))
            .authorizeHttpRequests(authorize -> {
                authorize.requestMatchers(HttpMethod.GET, "/auth/wechat-miniapp/enabled").permitAll();
                authorize.requestMatchers(HttpMethod.GET, BrowserSessionCookies.PATH + "/csrf").permitAll();
                authorize.requestMatchers(HttpMethod.POST, BrowserSessionCookies.PATH).permitAll();
                authorize.requestMatchers(HttpMethod.DELETE, BrowserSessionCookies.PATH).permitAll();
                if (!publicMatchers.isEmpty()) {
                    authorize.requestMatchers(publicMatchers.toArray(String[]::new)).permitAll();
                }
                if (strictAuthentication) {
                    authorize.anyRequest().authenticated();
                } else {
                    authorize.anyRequest().permitAll();
                }
            });
        http.addFilterBefore(new BrowserSessionGuardFilter(browserProperties, browserCookies, objectMapper), CsrfFilter.class);
        if (strictAuthentication) {
            http.addFilterBefore(tokenAuthenticationFilter.getObject(), UsernamePasswordAuthenticationFilter.class);
        }
        return http.build();
    }

    static List<String> resolvePublicMatchers(SecurityProperties securityProperties) {
        return resolvePublicMatchers(securityProperties, new SseProperties());
    }

    static List<String> resolvePublicMatchers(SecurityProperties securityProperties, SseProperties sseProperties) {
        Set<String> matchers = new LinkedHashSet<>();
        if (securityProperties != null && securityProperties.getExcludes() != null) {
            for (String exclude : securityProperties.getExcludes()) {
                if (exclude != null && !exclude.isBlank()) {
                    matchers.add(exclude);
                }
            }
        }
        matchers.addAll(DEFAULT_PUBLIC_MATCHERS);
        matchers.add(resolveSseConnectPath(sseProperties));
        return new ArrayList<>(matchers);
    }

    private static String resolveSseConnectPath(SseProperties sseProperties) {
        if (sseProperties == null || sseProperties.getPath() == null || sseProperties.getPath().isBlank()) {
            return DEFAULT_SSE_PATH;
        }
        return sseProperties.getPath();
    }

    static boolean isStrictAuthentication(Environment environment) {
        return environment.getProperty(STRICT_AUTHENTICATION_PROPERTY, Boolean.class, true);
    }
}
