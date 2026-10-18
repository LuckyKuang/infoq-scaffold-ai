package cc.infoq.system.controller.system;

import cc.infoq.common.domain.ApiResult;
import cc.infoq.common.security.auth.LoginUserContext;
import cc.infoq.system.domain.bo.SysUserBo;
import cc.infoq.system.domain.bo.SysUserPasswordBo;
import cc.infoq.system.domain.bo.SysUserProfileBo;
import cc.infoq.system.domain.vo.SysOssVo;
import cc.infoq.system.domain.vo.SysUserVo;
import cc.infoq.system.service.SysOssService;
import cc.infoq.system.service.SysUserService;
import cn.hutool.crypto.digest.BCrypt;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.multipart.MultipartFile;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@Tag("dev")
class SysProfileControllerTest {

    @Mock
    private SysUserService sysUserService;
    @Mock
    private SysOssService sysOssService;

    @InjectMocks
    private SysProfileController controller;

    @Test
    @DisplayName("updateProfile: should fail when phone number already exists")
    void updateProfileShouldFailWhenPhoneExists() {
        SysUserProfileBo profile = new SysUserProfileBo();
        profile.setPhonenumber("13800138000");
        when(sysUserService.checkPhoneUnique(any(SysUserBo.class))).thenReturn(false);

        try (MockedStatic<LoginUserContext> loginHelper = mockStatic(LoginUserContext.class)) {
            loginHelper.when(LoginUserContext::getUserId).thenReturn(100L);
            loginHelper.when(LoginUserContext::getUsername).thenReturn("admin");

            ApiResult<Void> result = controller.updateProfile(profile);

            assertEquals(ApiResult.FAIL, result.getCode());
            assertTrue(result.getMsg().contains("手机号码已存在"));
            verify(sysUserService, never()).updateUserProfile(any());
        }
    }

    @Test
    @DisplayName("profile: should assemble profile user with role and post groups")
    void profileShouldAssembleProfileData() {
        SysUserVo user = new SysUserVo();
        user.setUserId(10L);
        user.setUserName("admin");
        when(sysUserService.selectUserById(10L)).thenReturn(user);
        when(sysUserService.selectUserRoleGroup(10L)).thenReturn("管理员");
        when(sysUserService.selectUserPostGroup(10L)).thenReturn("产品经理");

        try (MockedStatic<LoginUserContext> loginHelper = mockStatic(LoginUserContext.class)) {
            loginHelper.when(LoginUserContext::getUserId).thenReturn(10L);

            ApiResult<SysProfileController.ProfileVo> result = controller.profile();

            assertEquals(ApiResult.SUCCESS, result.getCode());
            assertNotNull(result.getData());
            assertEquals(10L, result.getData().user().getUserId());
            assertEquals("管理员", result.getData().roleGroup());
            assertEquals("产品经理", result.getData().postGroup());
        }
    }

    @Test
    @DisplayName("updateProfile: should return success when profile update rows greater than zero")
    void updateProfileShouldReturnSuccessWhenRowsPositive() {
        SysUserProfileBo profile = new SysUserProfileBo();
        profile.setPhonenumber("13800138001");
        profile.setEmail("admin@test.com");
        when(sysUserService.checkPhoneUnique(any(SysUserBo.class))).thenReturn(true);
        when(sysUserService.checkEmailUnique(any(SysUserBo.class))).thenReturn(true);
        when(sysUserService.updateUserProfile(any(SysUserBo.class))).thenReturn(1);

        try (MockedStatic<LoginUserContext> loginHelper = mockStatic(LoginUserContext.class)) {
            loginHelper.when(LoginUserContext::getUserId).thenReturn(101L);
            loginHelper.when(LoginUserContext::getUsername).thenReturn("admin");

            ApiResult<Void> result = controller.updateProfile(profile);

            assertEquals(ApiResult.SUCCESS, result.getCode());
            verify(sysUserService).updateUserProfile(any(SysUserBo.class));
        }
    }

    @Test
    @DisplayName("updatePwd: should fail when old password is wrong")
    void updatePwdShouldFailWhenOldPasswordWrong() {
        SysUserPasswordBo bo = new SysUserPasswordBo();
        bo.setOldPassword("wrong-pass");
        bo.setNewPassword("new-pass-1");
        SysUserVo user = new SysUserVo();
        user.setUserId(8L);
        user.setPassword(BCrypt.hashpw("correct-pass"));
        when(sysUserService.selectUserById(8L)).thenReturn(user);

        try (MockedStatic<LoginUserContext> loginHelper = mockStatic(LoginUserContext.class)) {
            loginHelper.when(LoginUserContext::getUserId).thenReturn(8L);

            ApiResult<Void> result = controller.updatePwd(bo);

            assertEquals(ApiResult.FAIL, result.getCode());
            assertTrue(result.getMsg().contains("旧密码错误"));
            verify(sysUserService, never()).resetUserPwd(any(), any());
        }
    }

    @Test
    @DisplayName("updatePwd: should fail when new password equals old password")
    void updatePwdShouldFailWhenNewPasswordEqualsOld() {
        SysUserPasswordBo bo = new SysUserPasswordBo();
        bo.setOldPassword("same-pass");
        bo.setNewPassword("same-pass");
        SysUserVo user = new SysUserVo();
        user.setUserId(9L);
        user.setPassword(BCrypt.hashpw("same-pass"));
        when(sysUserService.selectUserById(9L)).thenReturn(user);

        try (MockedStatic<LoginUserContext> loginHelper = mockStatic(LoginUserContext.class)) {
            loginHelper.when(LoginUserContext::getUserId).thenReturn(9L);

            ApiResult<Void> result = controller.updatePwd(bo);

            assertEquals(ApiResult.FAIL, result.getCode());
            assertTrue(result.getMsg().contains("新密码不能与旧密码相同"));
            verify(sysUserService, never()).resetUserPwd(any(), any());
        }
    }

    @Test
    @DisplayName("updatePwd: should return success when password reset rows greater than zero")
    void updatePwdShouldReturnSuccessWhenRowsPositive() {
        SysUserPasswordBo bo = new SysUserPasswordBo();
        bo.setOldPassword("old-pass");
        bo.setNewPassword("new-pass");
        SysUserVo user = new SysUserVo();
        user.setUserId(7L);
        user.setPassword(BCrypt.hashpw("old-pass"));
        when(sysUserService.selectUserById(7L)).thenReturn(user);
        when(sysUserService.resetUserPwd(eq(7L), any())).thenReturn(1);

        try (MockedStatic<LoginUserContext> loginHelper = mockStatic(LoginUserContext.class)) {
            loginHelper.when(LoginUserContext::getUserId).thenReturn(7L);

            ApiResult<Void> result = controller.updatePwd(bo);

            assertEquals(ApiResult.SUCCESS, result.getCode());
            verify(sysUserService).resetUserPwd(eq(7L), any());
        }
    }

    @Test
    @DisplayName("avatar: should fail when file extension is not image")
    void avatarShouldFailWhenExtensionInvalid() {
        MultipartFile avatarFile = mock(MultipartFile.class);
        when(avatarFile.isEmpty()).thenReturn(false);
        when(avatarFile.getOriginalFilename()).thenReturn("avatar.txt");

        ApiResult<SysProfileController.AvatarVo> result = controller.avatar(avatarFile);

        assertEquals(ApiResult.FAIL, result.getCode());
        assertTrue(result.getMsg().contains("文件格式不正确"));
        verifyNoInteractions(sysOssService);
    }

    @Test
    @DisplayName("avatar: should return avatar url when upload and update succeed")
    void avatarShouldReturnSuccessWhenUploadAndUpdateSucceed() {
        MultipartFile avatarFile = mock(MultipartFile.class);
        when(avatarFile.isEmpty()).thenReturn(false);
        when(avatarFile.getOriginalFilename()).thenReturn("avatar.png");
        SysOssVo ossVo = new SysOssVo();
        ossVo.setOssId(66L);
        ossVo.setUrl("https://cdn.test/avatar.png");
        when(sysOssService.upload(avatarFile)).thenReturn(ossVo);
        when(sysUserService.updateUserAvatar(3L, 66L)).thenReturn(true);

        try (MockedStatic<LoginUserContext> loginHelper = mockStatic(LoginUserContext.class)) {
            loginHelper.when(LoginUserContext::getUserId).thenReturn(3L);

            ApiResult<SysProfileController.AvatarVo> result = controller.avatar(avatarFile);

            assertEquals(ApiResult.SUCCESS, result.getCode());
            assertNotNull(result.getData());
            assertEquals("https://cdn.test/avatar.png", result.getData().imgUrl());
        }
    }

    @Test
    @DisplayName("avatar: should fail when file empty")
    void avatarShouldFailWhenFileEmpty() {
        MultipartFile avatarFile = mock(MultipartFile.class);
        when(avatarFile.isEmpty()).thenReturn(true);

        ApiResult<SysProfileController.AvatarVo> result = controller.avatar(avatarFile);

        assertEquals(ApiResult.FAIL, result.getCode());
        assertTrue(result.getMsg().contains("上传图片异常"));
    }
}
