package cc.infoq.common.web.filter;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import java.nio.charset.StandardCharsets;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Tag("dev")
class XssHttpServletRequestWrapperTest {

    @Test
    @DisplayName("parameters: should sanitize html tags for single value/map/array values")
    void parametersShouldSanitizeHtmlTags() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setParameter("name", " <b>alice</b> ");
        request.addParameter("tags", " <script>x</script> ", "<i>y</i>");

        XssHttpServletRequestWrapper wrapper = new XssHttpServletRequestWrapper(request);

        assertEquals("alice", wrapper.getParameter("name"));
        String[] values = wrapper.getParameterValues("tags");
        assertNotNull(values);
        assertEquals(2, values.length);
        assertFalse(values[0].contains("<"));
        assertFalse(values[1].contains("<"));

        Map<String, String[]> map = wrapper.getParameterMap();
        assertFalse(map.get("name")[0].contains("<"));
        assertFalse(map.get("tags")[0].contains("<"));
    }

    @Test
    @DisplayName("inputStream: should keep original body for non-json requests")
    void inputStreamShouldKeepOriginalBodyForNonJsonRequest() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Content-Type", "text/plain");
        request.setContent("plain<body>".getBytes(StandardCharsets.UTF_8));

        XssHttpServletRequestWrapper wrapper = new XssHttpServletRequestWrapper(request);
        String body = new String(wrapper.getInputStream().readAllBytes(), StandardCharsets.UTF_8);

        assertEquals("plain<body>", body);
        assertFalse(wrapper.isJsonRequest());
    }

    @Test
    @DisplayName("inputStream: should sanitize json body and mark request as json")
    void inputStreamShouldSanitizeJsonBody() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Content-Type", "application/json;charset=UTF-8");
        request.setContent("{\"name\":\"<b>alice</b>\"}".getBytes(StandardCharsets.UTF_8));

        XssHttpServletRequestWrapper wrapper = new XssHttpServletRequestWrapper(request);
        String body = new String(wrapper.getInputStream().readAllBytes(), StandardCharsets.UTF_8);

        assertTrue(wrapper.isJsonRequest());
        assertFalse(body.contains("<b>"));
        assertTrue(body.contains("alice"));
    }

    @Test
    @DisplayName("inputStream/parameters: should expose inner stream state and null parameter path")
    void inputStreamAndParameterNullPathShouldExposeInnerState() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Content-Type", "application/json");
        request.setContent("{\"name\":\"<b>alice</b>\"}".getBytes(StandardCharsets.UTF_8));

        XssHttpServletRequestWrapper wrapper = new XssHttpServletRequestWrapper(request);
        var inputStream = wrapper.getInputStream();

        assertTrue(inputStream.isFinished());
        assertTrue(inputStream.isReady());
        assertEquals(16, inputStream.available());
        assertDoesNotThrow(() -> inputStream.setReadListener(null));
        assertNull(wrapper.getParameter("missing"));
    }
}
