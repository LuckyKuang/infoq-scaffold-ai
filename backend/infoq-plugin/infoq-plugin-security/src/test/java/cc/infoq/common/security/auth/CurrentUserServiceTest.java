package cc.infoq.common.security.auth;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.context.SecurityContextHolder;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Tag("dev")
class CurrentUserServiceTest {

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("current user: should fail explicitly when security context is missing")
    void currentUserShouldFailExplicitlyWhenSecurityContextMissing() {
        SecurityContextHolder.clearContext();
        CurrentUserService currentUserService = new CurrentUserService();

        SecurityAuthenticationException ex = assertThrows(SecurityAuthenticationException.class, currentUserService::getLoginUser);

        assertTrue(ex.getMessage().contains("Spring Security authentication is missing"));
    }

}
