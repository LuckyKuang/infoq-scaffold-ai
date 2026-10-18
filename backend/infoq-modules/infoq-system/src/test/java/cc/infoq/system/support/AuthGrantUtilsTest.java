package cc.infoq.system.support;

import cc.infoq.system.domain.vo.SysClientVo;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Tag("dev")
class AuthGrantUtilsTest {

    @Test
    @DisplayName("supportsGrantType: should match exact comma-separated grant type")
    void supportsGrantTypeShouldMatchExactCommaSeparatedGrantType() {
        SysClientVo client = new SysClientVo();
        client.setGrantType("password, oauth ,email");

        assertTrue(AuthGrantUtils.supportsGrantType(client, "oauth"));
        assertFalse(AuthGrantUtils.supportsGrantType(client, "auth"));
        assertFalse(AuthGrantUtils.supportsGrantType(client, "oauth2"));
    }

    @Test
    @DisplayName("supportsGrantType: should reject blank client or grant type")
    void supportsGrantTypeShouldRejectBlankClientOrGrantType() {
        SysClientVo client = new SysClientVo();
        client.setGrantType("password");

        assertFalse(AuthGrantUtils.supportsGrantType(null, "password"));
        assertFalse(AuthGrantUtils.supportsGrantType(client, ""));
    }
}
