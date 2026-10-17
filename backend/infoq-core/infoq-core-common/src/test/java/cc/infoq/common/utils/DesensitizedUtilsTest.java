package cc.infoq.common.utils;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

@Tag("dev")
class DesensitizedUtilsTest {

    @Test
    void maskShouldCoverAllBranches() {
        assertNull(DesensitizedUtils.mask(null, 2, 2, 4));
        assertEquals("  ", DesensitizedUtils.mask("  ", 2, 2, 4));
        assertEquals("***", DesensitizedUtils.mask("abc", 1, 1, 5));
        assertEquals("ab****", DesensitizedUtils.mask("abcdef", 2, 1, 4));
        assertEquals("ab**ef", DesensitizedUtils.mask("abcdef", 2, 2, 2));
        assertEquals("ab***ij", DesensitizedUtils.mask("abcdefghij", 2, 2, 3));
    }

    @Test
    void maskHighSecurityShouldCoverAllBranches() {
        assertNull(DesensitizedUtils.maskHighSecurity(null, 2, 2));
        assertEquals("  ", DesensitizedUtils.maskHighSecurity("  ", 2, 2));
        assertEquals("****", DesensitizedUtils.maskHighSecurity("abcd", 4, 1));
        assertEquals("ab**", DesensitizedUtils.maskHighSecurity("abcd", 2, 3));
        assertEquals("ab****gh", DesensitizedUtils.maskHighSecurity("abcdefgh", 2, 2));
    }
}
