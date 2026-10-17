package cc.infoq.common.web.filter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertSame;

@Tag("dev")
class RepeatableFilterTest {

    @Test
    @DisplayName("doFilter: should wrap json http request with repeatedly wrapper")
    void doFilterShouldWrapJsonHttpRequest() throws Exception {
        RepeatableFilter filter = new RepeatableFilter();
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/demo");
        request.setContentType("application/json;charset=UTF-8");
        request.setContent("{\"name\":\"alice\"}".getBytes(StandardCharsets.UTF_8));
        MockHttpServletResponse response = new MockHttpServletResponse();
        CapturingFilterChain chain = new CapturingFilterChain();

        filter.doFilter(request, response, chain);

        assertInstanceOf(RepeatedlyRequestWrapper.class, chain.capturedRequest);
        assertSame(response, chain.capturedResponse);
    }

    @Test
    @DisplayName("doFilter: should pass original request when content type is not json")
    void doFilterShouldPassOriginalRequestWhenNotJson() throws Exception {
        RepeatableFilter filter = new RepeatableFilter();
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/demo");
        request.setContentType("text/plain");
        request.setContent("plain".getBytes(StandardCharsets.UTF_8));
        MockHttpServletResponse response = new MockHttpServletResponse();
        CapturingFilterChain chain = new CapturingFilterChain();

        filter.doFilter(request, response, chain);

        assertSame(request, chain.capturedRequest);
        assertSame(response, chain.capturedResponse);
    }

    @Test
    @DisplayName("lifecycle: init and destroy should be no-op")
    void lifecycleShouldBeNoOp() {
        RepeatableFilter filter = new RepeatableFilter();
        assertDoesNotThrow(() -> filter.init(null));
        assertDoesNotThrow(filter::destroy);
    }

    private static final class CapturingFilterChain implements FilterChain {

        private ServletRequest capturedRequest;
        private ServletResponse capturedResponse;

        @Override
        public void doFilter(ServletRequest request, ServletResponse response) throws IOException, ServletException {
            this.capturedRequest = request;
            this.capturedResponse = response;
        }
    }
}
