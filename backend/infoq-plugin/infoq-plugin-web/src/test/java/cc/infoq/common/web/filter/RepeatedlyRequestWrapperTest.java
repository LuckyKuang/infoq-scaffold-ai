package cc.infoq.common.web.filter;

import cc.infoq.common.constant.Constants;
import jakarta.servlet.ServletInputStream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

@Tag("dev")
class RepeatedlyRequestWrapperTest {

    @Test
    @DisplayName("constructor/getReader/getInputStream: should keep body and expose repeatable stream contract")
    void constructorAndInputStreamShouldKeepBodyAndContract() throws Exception {
        String json = "{\"name\":\"alice\"}";
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/demo");
        request.setContent(json.getBytes(StandardCharsets.UTF_8));
        MockHttpServletResponse response = new MockHttpServletResponse();

        RepeatedlyRequestWrapper wrapper = new RepeatedlyRequestWrapper(request, response);
        ServletInputStream inputStream = wrapper.getInputStream();

        assertEquals(Constants.UTF8, request.getCharacterEncoding());
        assertEquals(Constants.UTF8, response.getCharacterEncoding());
        assertEquals(json.length(), inputStream.available());
        assertFalse(inputStream.isFinished());
        assertFalse(inputStream.isReady());
        assertDoesNotThrow(() -> inputStream.setReadListener(null));
        assertEquals(json, wrapper.getReader().readLine());
    }
}
