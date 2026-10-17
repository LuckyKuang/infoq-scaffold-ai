package cc.infoq.common.security.handler;

import cc.infoq.common.constant.HttpStatus;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.BadCredentialsException;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;

@Tag("dev")
class SecurityAuthenticationEntryPointTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    @DisplayName("commence: should write 401 ApiResult json without sensitive exception content")
    void commenceShouldWriteUnauthorizedApiResultJson() throws Exception {
        SecurityAuthenticationEntryPoint entryPoint = new SecurityAuthenticationEntryPoint(objectMapper);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/system/user/getInfo");
        MockHttpServletResponse response = new MockHttpServletResponse();

        entryPoint.commence(request, response,
            new BadCredentialsException("token=secret-token-value signing-secret=raw-secret"));

        String content = response.getContentAsString(StandardCharsets.UTF_8);
        JsonNode body = objectMapper.readTree(content);
        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatus());
        assertTrue(response.getContentType().startsWith("application/json"));
        assertEquals(HttpStatus.UNAUTHORIZED, body.get("code").asInt());
        assertEquals("认证失败，无法访问系统资源", body.get("msg").asText());
        assertFalse(content.contains("secret-token-value"));
        assertFalse(content.contains("raw-secret"));
    }
}
