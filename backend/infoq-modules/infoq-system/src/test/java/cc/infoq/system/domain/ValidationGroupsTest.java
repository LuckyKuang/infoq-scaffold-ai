package cc.infoq.system.domain;

import cc.infoq.common.domain.model.ForgotPasswordBody;
import cc.infoq.common.domain.model.RegisterBody;
import cc.infoq.common.domain.model.SendEmailCodeBody;
import cc.infoq.common.validate.*;
import cc.infoq.system.domain.bo.*;
import cc.infoq.system.domain.entity.SysUserRole;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

@Tag("dev")
class ValidationGroupsTest {

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    @DisplayName("status group: should require clientId and status for client status change")
    void statusGroupShouldRequireClientStatusFields() {
        SysClientBo bo = new SysClientBo();

        assertEquals(2, validator.validate(bo, StatusGroup.class).size());
    }

    @Test
    @DisplayName("data scope group: should require roleId and dataScope")
    void dataScopeGroupShouldRequireRoleDataScopeFields() {
        SysRoleBo bo = new SysRoleBo();

        assertEquals(2, validator.validate(bo, DataScopeGroup.class).size());
    }

    @Test
    @DisplayName("reset password group: should require userId and password")
    void resetPwdGroupShouldRequireUserIdAndPassword() {
        SysUserBo bo = new SysUserBo();

        assertEquals(2, validator.validate(bo, ResetPwdGroup.class).size());
    }

    @Test
    @DisplayName("reset password fields: should reject weak passwords on write paths")
    void writePasswordFieldsShouldRejectWeakPasswords() {
        SysUserBo resetPwdBo = new SysUserBo();
        resetPwdBo.setUserId(1L);
        resetPwdBo.setPassword("123456");

        SysUserPasswordBo profilePwdBo = new SysUserPasswordBo();
        profilePwdBo.setOldPassword("OldPass1!");
        profilePwdBo.setNewPassword("123456");

        assertEquals(2, validator.validate(resetPwdBo, ResetPwdGroup.class).size());
        assertEquals(2, validator.validate(profilePwdBo).size());
    }

    @Test
    @DisplayName("update by key group: should require configKey and configValue")
    void updateByKeyGroupShouldRequireConfigKeyAndValue() {
        SysConfigBo bo = new SysConfigBo();

        assertEquals(2, validator.validate(bo, UpdateByKeyGroup.class).size());
    }

    @Test
    @DisplayName("status group: should require ossConfigId and status")
    void statusGroupShouldRequireOssConfigStatusFields() {
        SysOssConfigBo bo = new SysOssConfigBo();

        assertEquals(2, validator.validate(bo, StatusGroup.class).size());
    }

    @Test
    @DisplayName("grant group: should require userId and roleId")
    void grantGroupShouldRequireUserRoleIds() {
        SysUserRole userRole = new SysUserRole();

        assertEquals(2, validator.validate(userRole, GrantGroup.class).size());
    }

    @Test
    @DisplayName("register body: should require email and strong password")
    void registerBodyShouldRequireEmailAndStrongPassword() {
        RegisterBody body = new RegisterBody();
        body.setClientId("pc");
        body.setGrantType("password");
        body.setUsername("admin");
        body.setPassword("123456");

        assertEquals(4, validator.validate(body).size());
    }

    @Test
    @DisplayName("forgot password body: should require email code and strong password")
    void forgotPasswordBodyShouldRequireEmailCodeAndStrongPassword() {
        ForgotPasswordBody body = new ForgotPasswordBody();
        body.setEmail("not-an-email");
        body.setNewPassword("123456");

        assertEquals(4, validator.validate(body).size());
    }

    @Test
    @DisplayName("send email code body: should reject unsupported scene")
    void sendEmailCodeBodyShouldRejectUnsupportedScene() {
        SendEmailCodeBody body = new SendEmailCodeBody();
        body.setEmail("dev@infoq.cc");
        body.setScene("signup");

        assertEquals(1, validator.validate(body).size());
    }
}
