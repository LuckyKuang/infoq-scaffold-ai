package cc.infoq.common.enums;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

@Tag("dev")
class UserTypeTest {

    @Test
    @DisplayName("getUserType: should resolve matching user type and throw when not matched")
    void getUserTypeShouldResolveMatchingUserTypeAndThrowWhenNotMatched() {
        assertEquals(UserType.SYS_USER, UserType.getUserType("token:sys_user:100"));
        assertThrows(RuntimeException.class, () -> UserType.getUserType("guest"));
    }
}
