package cc.infoq.common.enums;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

@Tag("dev")
class FormatsTypeTest {

    @Test
    @DisplayName("getFormatsType: should resolve matching format and throw when not matched")
    void getFormatsTypeShouldResolveMatchingFormatAndThrowWhenNotMatched() {
        assertEquals(FormatsType.YY, FormatsType.getFormatsType("yy-MM-dd"));
        assertEquals(FormatsType.YYYY_MM_DD, FormatsType.getFormatsType("yyyy-MM-dd"));
        assertEquals(FormatsType.YYYY_MM_DD_HH_MM_SS, FormatsType.getFormatsType("yyyy-MM-dd HH:mm:ss"));
        assertEquals(FormatsType.YYYY_MM_DD_HH_MM_SS, FormatsType.getFormatsType("format: yyyy-MM-dd HH:mm:ss"));
        assertThrows(RuntimeException.class, () -> FormatsType.getFormatsType("not-a-format"));
    }
}
