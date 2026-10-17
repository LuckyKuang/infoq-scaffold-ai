package cc.infoq.common.security.handler;

import cc.infoq.common.constant.HttpStatus;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.access.AccessDeniedException;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;

@Tag("dev")
class SecurityAccessDeniedHandlerTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    @DisplayName("handle: should write 403 ApiResult json without sensitive exception content")
    void handleShouldWriteForbiddenApiResultJson() throws Exception {
        SecurityAccessDeniedHandler handler = new SecurityAccessDeniedHandler(objectMapper);
        MockHttpServletRequest request = new MockHttpServletRequest("DELETE", "/monitor/online/token");
        MockHttpServletResponse response = new MockHttpServletResponse();

        handler.handle(request, response,
            new AccessDeniedException("permission denied for token=secret-token-value"));

        String content = response.getContentAsString(StandardCharsets.UTF_8);
        JsonNode body = objectMapper.readTree(content);
        assertEquals(HttpStatus.FORBIDDEN, response.getStatus());
        assertTrue(response.getContentType().startsWith("application/json"));
        assertEquals(HttpStatus.FORBIDDEN, body.get("code").asInt());
        assertEquals("没有访问权限，请联系管理员授权", body.get("msg").asText());
        assertFalse(content.contains("secret-token-value"));
    }
}
