package cc.infoq.common.web.filter;

import cc.infoq.common.utils.SpringUtils;
import cc.infoq.common.web.config.properties.XssProperties;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.context.support.GenericApplicationContext;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.io.IOException;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Tag("dev")
class XssFilterTest {

    @Test
    @DisplayName("init: should load exclude urls from xss properties bean")
    void initShouldLoadExcludeUrlsFromPropertiesBean() throws Exception {
        XssFilter filter = new XssFilter();
        GenericApplicationContext context = new GenericApplicationContext();
        context.registerBean(XssProperties.class, () -> {
            XssProperties properties = new XssProperties();
            properties.setExcludeUrls(List.of("/health", "/open/*"));
            return properties;
        });
        context.refresh();
        new SpringUtils().setApplicationContext(context);
        filter.init(Mockito.mock(jakarta.servlet.FilterConfig.class));

        assertTrue(filter.excludes.contains("/health"));
        assertTrue(filter.excludes.contains("/open/*"));
    }

    @Test
    @DisplayName("doFilter: should bypass wrapper for excluded request")
    void doFilterShouldBypassWrapperForExcludedRequest() throws Exception {
        XssFilter filter = new XssFilter();
        filter.excludes.add("/health");
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/health");
        request.setServletPath("/health");
        MockHttpServletResponse response = new MockHttpServletResponse();
        CapturingFilterChain chain = new CapturingFilterChain();

        filter.doFilter(request, response, chain);

        assertSame(request, chain.capturedRequest);
    }

    @Test
    @DisplayName("doFilter: should bypass wrapper for GET and wrap non-excluded POST")
    void doFilterShouldBypassGetAndWrapNonExcludedPost() throws Exception {
        XssFilter filter = new XssFilter();
        MockHttpServletResponse response = new MockHttpServletResponse();

        MockHttpServletRequest getRequest = new MockHttpServletRequest("GET", "/api/users");
        getRequest.setServletPath("/api/users");
        CapturingFilterChain getChain = new CapturingFilterChain();
        filter.doFilter(getRequest, response, getChain);
        assertSame(getRequest, getChain.capturedRequest);

        MockHttpServletRequest postRequest = new MockHttpServletRequest("POST", "/api/users");
        postRequest.setServletPath("/api/users");
        CapturingFilterChain postChain = new CapturingFilterChain();
        filter.doFilter(postRequest, response, postChain);
        assertInstanceOf(XssHttpServletRequestWrapper.class, postChain.capturedRequest);
    }

    @Test
    @DisplayName("destroy: should be no-op")
    void destroyShouldBeNoOp() {
        XssFilter filter = new XssFilter();
        assertDoesNotThrow(filter::destroy);
    }

    private static final class CapturingFilterChain implements FilterChain {

        private HttpServletRequest capturedRequest;

        @Override
        public void doFilter(ServletRequest request, ServletResponse response) throws IOException, ServletException {
            this.capturedRequest = (HttpServletRequest) request;
        }
    }
}
