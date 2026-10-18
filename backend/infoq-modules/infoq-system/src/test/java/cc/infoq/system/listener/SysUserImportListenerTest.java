package cc.infoq.system.listener;

import cc.infoq.common.exception.ServiceException;
import cc.infoq.common.security.auth.LoginUserContext;
import cc.infoq.common.utils.SpringUtils;
import cc.infoq.system.domain.bo.SysUserBo;
import cc.infoq.system.domain.vo.SysUserImportVo;
import cc.infoq.system.domain.vo.SysUserVo;
import cc.infoq.system.service.SysConfigService;
import cc.infoq.system.service.SysUserService;
import cn.idev.excel.context.AnalysisContext;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.support.GenericApplicationContext;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@Tag("dev")
class SysUserImportListenerTest {

    @Mock
    private SysConfigService configService;

    @Mock
    private SysUserService userService;

    private GenericApplicationContext context;

    @AfterEach
    void tearDown() {
        // SpringUtils holds a global static context; avoid closing it here to prevent
        // cross-test IllegalStateException in tests that instantiate SysUserImportListener.
        context = null;
    }

    @Test
    @DisplayName("invoke: should report duplicate user when update support is disabled")
    void invokeShouldReportDuplicateWhenUpdateSupportDisabled() {
        context = new GenericApplicationContext();
        context.registerBean(SysConfigService.class, () -> configService);
        context.registerBean(SysUserService.class, () -> userService);
        context.registerBean(Validator.class, () -> Validation.buildDefaultValidatorFactory().getValidator());
        context.refresh();
        new SpringUtils().setApplicationContext(context);

        when(configService.selectConfigByKey("sys.user.initPassword")).thenReturn("123456");

        SysUserImportVo userVo = new SysUserImportVo();
        userVo.setUserName("dup_user");
        SysUserVo exists = new SysUserVo();
        exists.setUserName("dup_user");
        when(userService.selectUserByUserName("dup_user")).thenReturn(exists);

        SysUserImportListener listener;
        try (MockedStatic<LoginUserContext> loginHelper = mockStatic(LoginUserContext.class)) {
            loginHelper.when(LoginUserContext::getUserId).thenReturn(1L);
            listener = new SysUserImportListener(false);
            listener.invoke(userVo, null);
        }

        ServiceException ex = assertThrows(ServiceException.class, () -> listener.getExcelResult().getAnalysis());
        assertTrue(ex.getMessage().contains("已存在"));
    }

    @Test
    @DisplayName("doAfterAllAnalysed/getList/getErrorList: should be no-op and return null lists")
    void doAfterAllAnalysedAndResultListGettersShouldBeNoOpOrNull() {
        context = new GenericApplicationContext();
        context.registerBean(SysConfigService.class, () -> configService);
        context.registerBean(SysUserService.class, () -> userService);
        context.registerBean(Validator.class, () -> Validation.buildDefaultValidatorFactory().getValidator());
        context.refresh();
        new SpringUtils().setApplicationContext(context);

        when(configService.selectConfigByKey("sys.user.initPassword")).thenReturn("123456");
        when(userService.selectUserByUserName("new_user")).thenReturn(null);

        SysUserImportVo userVo = new SysUserImportVo();
        userVo.setUserName("new_user");
        userVo.setNickName("新用户");
        SysUserImportListener listener;
        try (MockedStatic<LoginUserContext> loginHelper = mockStatic(LoginUserContext.class)) {
            loginHelper.when(LoginUserContext::getUserId).thenReturn(1L);
            listener = new SysUserImportListener(false);
            listener.invoke(userVo, null);
        }

        assertDoesNotThrow(() -> listener.doAfterAllAnalysed(org.mockito.Mockito.mock(AnalysisContext.class)));
        assertNull(listener.getExcelResult().getList());
        assertNull(listener.getExcelResult().getErrorList());
        verify(userService).insertUser(any(SysUserBo.class));
    }
}
