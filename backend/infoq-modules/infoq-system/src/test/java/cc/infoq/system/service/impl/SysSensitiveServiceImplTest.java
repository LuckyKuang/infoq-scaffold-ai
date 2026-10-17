package cc.infoq.system.service.impl;

import cc.infoq.common.security.auth.LoginUserContext;
import cc.infoq.common.security.auth.SecurityAuthorizationService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;

@Tag("dev")
class SysSensitiveServiceImplTest {

    @Test
    @DisplayName("isSensitive: should return true when user is not logged in")
    void isSensitiveShouldReturnTrueWhenNotLogin() {
        SysSensitiveServiceImpl service = new SysSensitiveServiceImpl(mock(SecurityAuthorizationService.class));

        try (MockedStatic<LoginUserContext> loginHelper = mockStatic(LoginUserContext.class)) {
            loginHelper.when(LoginUserContext::isLogin).thenReturn(false);

            assertTrue(service.isSensitive(new String[]{"role"}, new String[]{"perm"}));
        }
    }
}
