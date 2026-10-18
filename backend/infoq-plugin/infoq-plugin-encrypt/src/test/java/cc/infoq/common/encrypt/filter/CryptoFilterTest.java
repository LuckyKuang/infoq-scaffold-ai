package cc.infoq.common.encrypt.filter;

import cc.infoq.common.encrypt.annotation.ApiEncrypt;
import cc.infoq.common.encrypt.properties.ApiDecryptProperties;
import cc.infoq.common.encrypt.utils.EncryptUtils;
import cc.infoq.common.utils.SpringUtils;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.context.support.GenericApplicationContext;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerExceptionResolver;
import org.springframework.web.servlet.HandlerExecutionChain;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@Tag("dev")
class CryptoFilterTest {

    @Test
    @DisplayName("destroy: should be callable as no-op")
    void destroyShouldBeCallable() {
        ApiDecryptProperties properties = new ApiDecryptProperties();
        CryptoFilter filter = new CryptoFilter(properties);
        filter.destroy();
    }

    @Test
    @DisplayName("doFilter: should decrypt request body when post header is present")
    void doFilterShouldDecryptRequestBodyWhenHeaderPresent() throws Exception {
        Map<String, String> rsaKey = EncryptUtils.generateRsaKey();
        String headerFlag = "X-Encrypt-Flag";
        String aesPassword = "1234567890abcdef";
        String rawBody = "{\"name\":\"alice\"}";
        String requestBody = EncryptUtils.encryptByAes(rawBody, aesPassword);
        String encryptedHeader = EncryptUtils.encryptByRsa(
            EncryptUtils.encryptByBase64(aesPassword),
            rsaKey.get(EncryptUtils.PUBLIC_KEY)
        );

        ApiDecryptProperties properties = new ApiDecryptProperties();
        properties.setHeaderFlag(headerFlag);
        properties.setPrivateKey(rsaKey.get(EncryptUtils.PRIVATE_KEY));
        properties.setPublicKey(rsaKey.get(EncryptUtils.PUBLIC_KEY));
        CryptoFilter filter = new CryptoFilter(properties);

        RequestMappingHandlerMapping mapping = mock(RequestMappingHandlerMapping.class);
        HandlerExceptionResolver exceptionResolver = mock(HandlerExceptionResolver.class);
        registerSpringBeans(mapping, exceptionResolver);

        Method method = CryptoController.class.getMethod("postEndpoint");
        HandlerExecutionChain chain = new HandlerExecutionChain(new HandlerMethod(new CryptoController(), method));

        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/encrypt/post");
        request.addHeader(headerFlag, encryptedHeader);
        request.setContent(requestBody.getBytes(StandardCharsets.UTF_8));
        MockHttpServletResponse response = new MockHttpServletResponse();
        when(mapping.getHandler(request)).thenReturn(chain);

        FilterChain filterChain = (req, resp) -> {
            String decryptedBody = new String(req.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            assertEquals(rawBody, decryptedBody);
            ((MockHttpServletResponse) resp).getWriter().write("ok");
        };

        filter.doFilter(request, response, filterChain);

        assertEquals("ok", response.getContentAsString());
    }

    @Test
    @DisplayName("doFilter: should resolve forbidden when post request lacks header but requires annotation")
    void doFilterShouldResolveForbiddenWhenHeaderMissingAndAnnotationPresent() throws Exception {
        ApiDecryptProperties properties = new ApiDecryptProperties();
        properties.setHeaderFlag("X-Encrypt-Flag");
        properties.setPrivateKey("private");
        properties.setPublicKey("public");
        CryptoFilter filter = new CryptoFilter(properties);

        RequestMappingHandlerMapping mapping = mock(RequestMappingHandlerMapping.class);
        HandlerExceptionResolver exceptionResolver = mock(HandlerExceptionResolver.class);
        registerSpringBeans(mapping, exceptionResolver);

        Method method = CryptoController.class.getMethod("postEndpoint");
        HandlerExecutionChain chain = new HandlerExecutionChain(new HandlerMethod(new CryptoController(), method));

        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/encrypt/post");
        request.setContent("{\"name\":\"alice\"}".getBytes(StandardCharsets.UTF_8));
        MockHttpServletResponse response = new MockHttpServletResponse();
        when(mapping.getHandler(request)).thenReturn(chain);

        FilterChain filterChain = mock(FilterChain.class);
        filter.doFilter(request, response, filterChain);

        verify(exceptionResolver).resolveException(any(), any(), any(), any());
        verify(filterChain, never()).doFilter(any(), any());
    }

    @Test
    @DisplayName("doFilter: should encrypt response body when ApiEncrypt(response=true)")
    void doFilterShouldEncryptResponseBodyWhenResponseFlagEnabled() throws Exception {
        Map<String, String> rsaKey = EncryptUtils.generateRsaKey();
        String headerFlag = "X-Encrypt-Flag";

        ApiDecryptProperties properties = new ApiDecryptProperties();
        properties.setHeaderFlag(headerFlag);
        properties.setPrivateKey(rsaKey.get(EncryptUtils.PRIVATE_KEY));
        properties.setPublicKey(rsaKey.get(EncryptUtils.PUBLIC_KEY));
        CryptoFilter filter = new CryptoFilter(properties);

        RequestMappingHandlerMapping mapping = mock(RequestMappingHandlerMapping.class);
        HandlerExceptionResolver exceptionResolver = mock(HandlerExceptionResolver.class);
        registerSpringBeans(mapping, exceptionResolver);

        Method method = CryptoController.class.getMethod("getResponseEncryptedEndpoint");
        HandlerExecutionChain chain = new HandlerExecutionChain(new HandlerMethod(new CryptoController(), method));

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/encrypt/get");
        MockHttpServletResponse response = new MockHttpServletResponse();
        when(mapping.getHandler(request)).thenReturn(chain);

        FilterChain filterChain = (req, resp) -> ((HttpServletResponse) resp).getWriter().write("payload");
        filter.doFilter(request, response, filterChain);

        String encryptedBody = response.getContentAsString();
        assertNotEquals("payload", encryptedBody);
        assertTrue(encryptedBody.length() > 0);
        String encryptedPassword = response.getHeader(headerFlag);
        assertNotNull(encryptedPassword);

        String encodedAes = EncryptUtils.decryptByRsa(encryptedPassword, rsaKey.get(EncryptUtils.PRIVATE_KEY));
        String aesPassword = EncryptUtils.decryptByBase64(encodedAes);
        String decryptedBody = EncryptUtils.decryptByAes(encryptedBody, aesPassword);
        assertEquals("payload", decryptedBody);
    }

    @Test
    @DisplayName("doFilter: should resolve internal error when ApiEncrypt lookup fails")
    void doFilterShouldResolveInternalErrorWhenAnnotationLookupFails() throws Exception {
        ApiDecryptProperties properties = new ApiDecryptProperties();
        properties.setHeaderFlag("X-Encrypt-Flag");
        properties.setPrivateKey("private");
        properties.setPublicKey("public");
        CryptoFilter filter = new CryptoFilter(properties);

        RequestMappingHandlerMapping mapping = mock(RequestMappingHandlerMapping.class);
        HandlerExceptionResolver exceptionResolver = mock(HandlerExceptionResolver.class);
        registerSpringBeans(mapping, exceptionResolver);

        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/encrypt/post");
        MockHttpServletResponse response = new MockHttpServletResponse();
        when(mapping.getHandler(request)).thenThrow(new IllegalStateException("mapping broken"));

        FilterChain filterChain = mock(FilterChain.class);
        filter.doFilter(request, response, filterChain);

        verify(exceptionResolver).resolveException(any(), any(), any(),
            org.mockito.ArgumentMatchers.argThat(ex -> {
                assertInstanceOf(cc.infoq.common.exception.ServiceException.class, ex);
                return "获取接口加密配置失败".equals(ex.getMessage());
            }));
        verify(filterChain, never()).doFilter(any(), any());
    }

    private static void registerSpringBeans(RequestMappingHandlerMapping mapping, HandlerExceptionResolver resolver) {
        GenericApplicationContext context = new GenericApplicationContext();
        context.registerBean("requestMappingHandlerMapping", RequestMappingHandlerMapping.class, () -> mapping);
        context.registerBean("handlerExceptionResolver", HandlerExceptionResolver.class, () -> resolver);
        context.refresh();
        new SpringUtils().setApplicationContext(context);
    }

    private static class CryptoController {

        @ApiEncrypt
        public void postEndpoint() {
        }

        @ApiEncrypt(response = true)
        public void getResponseEncryptedEndpoint() {
        }
    }
}
