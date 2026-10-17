package cc.infoq.common.utils.file;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;

@Tag("dev")
class MimeTypeUtilsTest {

    @Test
    void constantsShouldBeInitialized() {
        assertEquals("image/png", MimeTypeUtils.IMAGE_PNG);
        assertEquals("image/jpg", MimeTypeUtils.IMAGE_JPG);
        assertEquals("image/jpeg", MimeTypeUtils.IMAGE_JPEG);
        assertEquals("image/bmp", MimeTypeUtils.IMAGE_BMP);
        assertEquals("image/gif", MimeTypeUtils.IMAGE_GIF);

        assertArrayEquals(new String[]{"bmp", "gif", "jpg", "jpeg", "png"}, MimeTypeUtils.IMAGE_EXTENSION);
        assertArrayEquals(new String[]{"swf", "flv"}, MimeTypeUtils.FLASH_EXTENSION);
        assertArrayEquals(new String[]{"mp4", "avi", "rmvb"}, MimeTypeUtils.VIDEO_EXTENSION);
    }
}
