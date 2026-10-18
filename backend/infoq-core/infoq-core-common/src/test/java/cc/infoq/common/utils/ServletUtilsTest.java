package cc.infoq.common.utils;

import jakarta.servlet.http.HttpSession;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.io.IOException;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Tag("dev")
class ServletUtilsTest {

    @AfterEach
    void tearDown() {
        RequestContextHolder.resetRequestAttributes();
    }

    @Test
    @DisplayName("parameter/session helpers: should read request parameters and session correctly")
    void parameterAndSessionHelpersShouldWork() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        request.setParameter("id", "12");
        request.setParameter("enabled", "true");
        request.setParameter("name", "alice");
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request, response));

        assertEquals("alice", ServletUtils.getParameter("name"));
        assertEquals("default", ServletUtils.getParameter("missing", "default"));
        assertEquals(12, ServletUtils.getParameterToInt("id"));
        assertEquals(10, ServletUtils.getParameterToInt("missingInt", 10));
        assertTrue(ServletUtils.getParameterToBool("enabled"));
        assertFalse(ServletUtils.getParameterToBool("missingBool", false));
        HttpSession session = ServletUtils.getSession();
        assertNotNull(session);

        RequestContextHolder.resetRequestAttributes();
        assertThrows(IllegalStateException.class, ServletUtils::getRequest);
        assertThrows(IllegalStateException.class, ServletUtils::getRequestAttributes);
    }

    @Test
    @DisplayName("params/header helpers: should expose parameter map and decode headers")
    void paramsAndHeaderHelpersShouldWork() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setParameter("ids", "1", "2");
        request.addHeader("token", ServletUtils.urlEncode("a b"));
        request.addHeader("X-Trace-Id", "trace-1");

        Map<String, String[]> params = ServletUtils.getParams(request);
        Map<String, String> paramMap = ServletUtils.getParamMap(request);
        Map<String, String> headers = ServletUtils.getHeaders(request);

        assertEquals(1, params.size());
        assertEquals("1,2", paramMap.get("ids"));
        assertEquals("a b", ServletUtils.getHeader(request, "token"));
        assertEquals("", ServletUtils.getHeader(request, "missing"));
        assertEquals("trace-1", headers.get("x-trace-id"));
    }

    @Test
    @DisplayName("renderString/isAjaxRequest/url helpers: should write response and detect ajax")
    void renderAndAjaxHelpersShouldWork() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        request.addHeader("accept", "application/json");
        request.setRequestURI("/api/users");
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request, response));

        ServletUtils.renderString(response, "{\"ok\":true}");

        assertEquals(200, response.getStatus());
        assertTrue(response.getContentType().startsWith("application/json"));
        assertEquals("{\"ok\":true}", response.getContentAsString());
        assertTrue(ServletUtils.isAjaxRequest(request));
        assertEquals("a b", ServletUtils.urlDecode(ServletUtils.urlEncode("a b")));
    }

    @Test
    @DisplayName("renderString: should throw explicit exception when response writer fails")
    void renderStringShouldThrowWhenResponseWriterFails() throws Exception {
        HttpServletResponse response = Mockito.mock(HttpServletResponse.class);
        Mockito.when(response.getWriter()).thenThrow(new IOException("writer broken"));

        IllegalStateException exception = assertThrows(IllegalStateException.class,
            () -> ServletUtils.renderString(response, "{\"ok\":true}"));

        assertEquals("响应写出失败", exception.getMessage());
    }
}
