package cc.infoq.common.encrypt.filter;

import cc.infoq.common.encrypt.utils.EncryptUtils;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.ServletOutputStream;
import jakarta.servlet.WriteListener;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.nio.charset.StandardCharsets;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

@Tag("dev")
class RequestResponseWrapperTest {

    @Test
    void decryptRequestBodyWrapperShouldExposeDecryptedBodyAndMetadata() throws Exception {
        Map<String, String> rsaKey = EncryptUtils.generateRsaKey();
        String headerFlag = "X-Encrypt-Flag";
        String plain = "{\"name\":\"alice\"}";
        String aesPassword = "1234567890abcdef";
        String body = EncryptUtils.encryptByAes(plain, aesPassword);
        String header = EncryptUtils.encryptByRsa(
            EncryptUtils.encryptByBase64(aesPassword),
            rsaKey.get(EncryptUtils.PUBLIC_KEY)
        );

        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/demo");
        request.addHeader(headerFlag, header);
        request.setContent(body.getBytes(StandardCharsets.UTF_8));

        DecryptRequestBodyWrapper wrapper =
            new DecryptRequestBodyWrapper(request, rsaKey.get(EncryptUtils.PRIVATE_KEY), headerFlag);

        assertEquals(MediaType.APPLICATION_JSON_VALUE, wrapper.getContentType());
        assertEquals(plain.getBytes(StandardCharsets.UTF_8).length, wrapper.getContentLength());
        assertEquals(plain.getBytes(StandardCharsets.UTF_8).length, wrapper.getContentLengthLong());
        assertEquals(plain, wrapper.getReader().readLine());

        ServletInputStream inputStream = wrapper.getInputStream();
        assertEquals(plain, new String(inputStream.readAllBytes(), StandardCharsets.UTF_8));
        assertTrue(inputStream.available() > 0);
        assertFalse(inputStream.isFinished());
        assertFalse(inputStream.isReady());
        inputStream.setReadListener(null);
    }

    @Test
    void encryptResponseBodyWrapperShouldWriteResetAndEncryptContent() throws Exception {
        Map<String, String> rsaKey = EncryptUtils.generateRsaKey();
        String headerFlag = "X-Encrypt-Flag";

        MockHttpServletResponse response = new MockHttpServletResponse();
        EncryptResponseBodyWrapper wrapper = new EncryptResponseBodyWrapper(response);

        ServletOutputStream outputStream = wrapper.getOutputStream();
        outputStream.write('a');
        outputStream.write("bc".getBytes(StandardCharsets.UTF_8));
        outputStream.write("def".getBytes(StandardCharsets.UTF_8), 1, 2);
        assertFalse(outputStream.isReady());
        outputStream.setWriteListener(mock(WriteListener.class));

        assertEquals("abcef", wrapper.getContent());
        assertEquals("abcef", new String(wrapper.getResponseData(), StandardCharsets.UTF_8));

        wrapper.reset();
        assertEquals("", wrapper.getContent());

        wrapper.getWriter().write("payload");
        String encryptedBody = wrapper.getEncryptContent(response, rsaKey.get(EncryptUtils.PUBLIC_KEY), headerFlag);
        assertNotEquals("payload", encryptedBody);
        assertTrue(encryptedBody.length() > 5);

        String encryptedPassword = response.getHeader(headerFlag);
        String aesPassword = EncryptUtils.decryptByBase64(
            EncryptUtils.decryptByRsa(encryptedPassword, rsaKey.get(EncryptUtils.PRIVATE_KEY))
        );
        assertEquals("payload", EncryptUtils.decryptByAes(encryptedBody, aesPassword));
        assertEquals("*", response.getHeader("Access-Control-Allow-Origin"));
        assertEquals(StandardCharsets.UTF_8.toString(), response.getCharacterEncoding());
    }
}
