package cc.infoq.system.service.impl;

import cc.infoq.common.domain.model.ForgotPasswordBody;
import cc.infoq.common.enums.EmailCodeScene;
import cc.infoq.common.exception.ServiceException;
import cc.infoq.common.exception.user.CaptchaException;
import cc.infoq.system.domain.vo.SysUserVo;
import cc.infoq.system.mapper.SysUserMapper;
import cc.infoq.system.service.AuthEmailCodeService;
import cc.infoq.system.service.SysLoginService;
import cc.infoq.system.service.SysUserService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@Tag("dev")
class SysForgotPasswordServiceImplTest {

    @Mock
    private AuthEmailCodeService authEmailCodeService;
    @Mock
    private SysUserMapper userMapper;
    @Mock
    private SysUserService sysUserService;
    @Mock
    private SysLoginService sysLoginService;

    @InjectMocks
    private SysForgotPasswordServiceImpl service;

    @Test
    @DisplayName("resetPassword: should fail with generic message when email is not bound")
    void resetPasswordShouldFailWhenEmailNotBound() {
        when(userMapper.selectVoOne(any())).thenReturn(null);

        assertThrows(ServiceException.class, () -> service.resetPassword(buildBody()));

        verifyNoInteractions(authEmailCodeService, sysUserService, sysLoginService);
    }

    @Test
    @DisplayName("resetPassword: should throw when email code mismatches")
    void resetPasswordShouldThrowWhenEmailCodeMismatches() {
        SysUserVo user = new SysUserVo();
        user.setUserId(9L);
        user.setUserType("sys_user");
        when(userMapper.selectVoOne(any())).thenReturn(user);
        when(authEmailCodeService.validateCode(EmailCodeScene.FORGOT_PASSWORD, "admin@infoq.cc", "5678")).thenReturn(false);

        assertThrows(CaptchaException.class, () -> service.resetPassword(buildBody()));
    }

    @Test
    @DisplayName("resetPassword: should hash password and invalidate sessions when code matches")
    void resetPasswordShouldHashPasswordAndInvalidateSessions() {
        SysUserVo user = new SysUserVo();
        user.setUserId(9L);
        user.setUserType("sys_user");
        when(userMapper.selectVoOne(any())).thenReturn(user);
        when(authEmailCodeService.validateCode(EmailCodeScene.FORGOT_PASSWORD, "admin@infoq.cc", "5678")).thenReturn(true);

        service.resetPassword(buildBody());

        ArgumentCaptor<String> passwordCaptor = ArgumentCaptor.forClass(String.class);
        verify(sysUserService).resetUserPwd(eq(9L), passwordCaptor.capture());
        verify(sysLoginService).invalidateUserSessions(9L, "sys_user");
        assertNotEquals("NewPass@123", passwordCaptor.getValue());
    }

    private ForgotPasswordBody buildBody() {
        ForgotPasswordBody body = new ForgotPasswordBody();
        body.setEmail("admin@infoq.cc");
        body.setEmailCode("5678");
        body.setNewPassword("NewPass@123");
        return body;
    }
}
