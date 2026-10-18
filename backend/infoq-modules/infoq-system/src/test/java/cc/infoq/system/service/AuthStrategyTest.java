package cc.infoq.system.service;

import cc.infoq.common.exception.ServiceException;
import cc.infoq.common.utils.SpringUtils;
import cc.infoq.system.domain.vo.SysClientVo;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mockStatic;

@Tag("dev")
class AuthStrategyTest {

    @Test
    @DisplayName("login: should throw when grantType bean not found")
    void loginShouldThrowWhenBeanMissing() {
        SysClientVo client = new SysClientVo();
        try (MockedStatic<SpringUtils> springUtils = mockStatic(SpringUtils.class)) {
            springUtils.when(() -> SpringUtils.containsBean("password" + AuthStrategy.BASE_NAME)).thenReturn(false);

            assertThrows(ServiceException.class, () -> AuthStrategy.login("{}", client, "password"));
        }
    }

    // Success branch relies on SpringUtil inherited static getBean(...), which is owned by parent class.
    // The missing-bean branch above is deterministic and guards the core error contract.
}
