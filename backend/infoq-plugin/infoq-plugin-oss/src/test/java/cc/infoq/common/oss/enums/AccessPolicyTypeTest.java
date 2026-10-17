package cc.infoq.common.oss.enums;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

@Tag("dev")
class AccessPolicyTypeTest {

    @Test
    @DisplayName("getByType: should resolve known policy codes")
    void getByTypeShouldResolveKnownPolicyCodes() {
        assertEquals(AccessPolicyType.PRIVATE, AccessPolicyType.getByType("0"));
        assertEquals(AccessPolicyType.PUBLIC, AccessPolicyType.getByType("1"));
        assertEquals(AccessPolicyType.CUSTOM, AccessPolicyType.getByType("2"));
    }

    @Test
    @DisplayName("getByType: should throw on unknown policy code")
    void getByTypeShouldThrowOnUnknownPolicyCode() {
        assertThrows(RuntimeException.class, () -> AccessPolicyType.getByType("unknown"));
    }
}
