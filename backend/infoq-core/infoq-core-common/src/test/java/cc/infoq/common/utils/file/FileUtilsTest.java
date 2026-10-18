package cc.infoq.common.utils.file;

import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

@Tag("dev")
class FileUtilsTest {

    @Test
    @DisplayName("setAttachmentResponseHeader: should set attachment related headers with encoded filename")
    void setAttachmentResponseHeaderShouldSetEncodedAttachmentHeaders() {
        HttpServletResponse response = mock(HttpServletResponse.class);
        String realFileName = "财务 报表.xlsx";
        String encodedName = FileUtils.percentEncode(realFileName);

        FileUtils.setAttachmentResponseHeader(response, realFileName);

        verify(response).addHeader("Access-Control-Expose-Headers", "Content-Disposition,download-filename");
        verify(response).setHeader(
            "Content-disposition",
            "attachment; filename=%s;filename*=utf-8''%s".formatted(encodedName, encodedName)
        );
        verify(response).setHeader("download-filename", encodedName);
    }

    @Test
    @DisplayName("percentEncode: should encode space as %20")
    void percentEncodeShouldEncodeSpaceAsPercent20() {
        assertEquals("a%20b", FileUtils.percentEncode("a b"));
    }
}
