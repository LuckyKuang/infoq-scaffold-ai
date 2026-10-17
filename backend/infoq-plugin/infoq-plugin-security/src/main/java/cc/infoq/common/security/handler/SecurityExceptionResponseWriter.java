package cc.infoq.common.security.handler;

import cc.infoq.common.domain.ApiResult;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * Writes Spring Security failures with the existing API envelope.
 */
final class SecurityExceptionResponseWriter {

    private SecurityExceptionResponseWriter() {
    }

    static void write(HttpServletResponse response, ObjectMapper objectMapper, ApiResult<Void> body)
        throws IOException {
        response.setStatus(body.getCode());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        objectMapper.writeValue(response.getWriter(), body);
    }
}
