package cc.infoq.common.mybatis.handler;

import cc.infoq.common.domain.model.LoginUser;
import cc.infoq.common.exception.ServiceException;
import cc.infoq.common.mybatis.core.domain.BaseEntity;
import cc.infoq.common.security.auth.LoginUserContext;
import cc.infoq.common.security.auth.SecurityAuthenticationException;
import org.apache.ibatis.reflection.SystemMetaObject;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;

import java.util.Date;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mockStatic;

@Tag("dev")
class InjectionMetaObjectHandlerTest {

    private final InjectionMetaObjectHandler handler = new InjectionMetaObjectHandler();

    @Test
    @DisplayName("insertFill: should populate creator fields from current login user")
    void insertFillShouldPopulateCreatorFieldsFromLoginUser() {
        BaseEntity entity = new BaseEntity();
        LoginUser loginUser = new LoginUser();
        loginUser.setUserId(99L);
        loginUser.setDeptId(8L);

        try (MockedStatic<LoginUserContext> loginHelper = mockStatic(LoginUserContext.class)) {
            loginHelper.when(LoginUserContext::getLoginUser).thenReturn(loginUser);

            handler.insertFill(SystemMetaObject.forObject(entity));
        }

        assertEquals(99L, entity.getCreateBy());
        assertEquals(99L, entity.getUpdateBy());
        assertEquals(8L, entity.getCreateDept());
        assertNotNull(entity.getCreateTime());
        assertNotNull(entity.getUpdateTime());
    }

    @Test
    @DisplayName("insertFill: should fail when login user is unavailable")
    void insertFillShouldFailWhenLoginUserMissing() {
        BaseEntity entity = new BaseEntity();

        try (MockedStatic<LoginUserContext> loginHelper = mockStatic(LoginUserContext.class)) {
            loginHelper.when(LoginUserContext::getLoginUser).thenThrow(new SecurityAuthenticationException("no session"));

            ServiceException exception = assertThrows(ServiceException.class, () -> handler.insertFill(SystemMetaObject.forObject(entity)));
            assertTrue(exception.getMessage().contains("no session"));
        }

        assertNull(entity.getCreateBy());
        assertNull(entity.getUpdateBy());
        assertNull(entity.getCreateDept());
    }

    @Test
    @DisplayName("insertFill: should preserve preset create fields")
    void insertFillShouldPreservePresetCreateFields() {
        BaseEntity entity = new BaseEntity();
        Date fixedTime = new Date(123456789L);
        entity.setCreateTime(fixedTime);
        entity.setCreateBy(7L);
        entity.setCreateDept(6L);

        handler.insertFill(SystemMetaObject.forObject(entity));

        assertSame(fixedTime, entity.getCreateTime());
        assertSame(fixedTime, entity.getUpdateTime());
        assertEquals(7L, entity.getCreateBy());
        assertEquals(6L, entity.getCreateDept());
        assertNull(entity.getUpdateBy());
    }

    @Test
    @DisplayName("updateFill: should use current login user id")
    void updateFillShouldUseCurrentLoginUserId() {
        BaseEntity entity = new BaseEntity();

        try (MockedStatic<LoginUserContext> loginHelper = mockStatic(LoginUserContext.class)) {
            loginHelper.when(LoginUserContext::getUserId).thenReturn(12L);
            handler.updateFill(SystemMetaObject.forObject(entity));
        }

        assertEquals(12L, entity.getUpdateBy());
        assertNotNull(entity.getUpdateTime());
    }

    @Test
    @DisplayName("updateFill: should fail when security context is unavailable")
    void updateFillShouldFailWhenSecurityContextUnavailable() {
        BaseEntity entity = new BaseEntity();

        try (MockedStatic<LoginUserContext> loginHelper = mockStatic(LoginUserContext.class)) {
            loginHelper.when(LoginUserContext::getUserId).thenThrow(new SecurityAuthenticationException("no session"));
            ServiceException exception = assertThrows(ServiceException.class, () -> handler.updateFill(SystemMetaObject.forObject(entity)));
            assertTrue(exception.getMessage().contains("no session"));
        }

        assertNull(entity.getUpdateBy());
        assertNotNull(entity.getUpdateTime());
    }

    @Test
    @DisplayName("insertFill/updateFill: should throw service exception when meta object is invalid")
    void fillShouldThrowServiceExceptionWhenMetaObjectInvalid() {
        assertThrows(ServiceException.class, () -> handler.insertFill(null));
        assertThrows(ServiceException.class, () -> handler.updateFill(null));
    }
}
