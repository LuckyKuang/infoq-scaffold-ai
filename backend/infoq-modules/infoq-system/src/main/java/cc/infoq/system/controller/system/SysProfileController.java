package cc.infoq.system.controller.system;

import cc.infoq.common.domain.ApiResult;
import cc.infoq.common.encrypt.annotation.ApiEncrypt;
import cc.infoq.common.log.annotation.Log;
import cc.infoq.common.log.enums.BusinessType;
import cc.infoq.common.mybatis.helper.DataPermissionHelper;
import cc.infoq.common.redis.annotation.RepeatSubmit;
import cc.infoq.common.security.auth.LoginUserContext;
import cc.infoq.common.utils.StringUtils;
import cc.infoq.common.utils.file.MimeTypeUtils;
import cc.infoq.common.web.core.BaseController;
import cc.infoq.system.domain.bo.SysUserBo;
import cc.infoq.system.domain.bo.SysUserPasswordBo;
import cc.infoq.system.domain.bo.SysUserProfileBo;
import cc.infoq.system.domain.vo.ProfileUserVo;
import cc.infoq.system.domain.vo.SysOssVo;
import cc.infoq.system.domain.vo.SysUserVo;
import cc.infoq.system.service.SysOssService;
import cc.infoq.system.service.SysUserService;
import cn.hutool.core.bean.BeanUtil;
import cn.hutool.core.io.FileUtil;
import cn.hutool.core.util.ObjectUtil;
import cn.hutool.crypto.digest.BCrypt;
import lombok.AllArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Arrays;

/**
 * 个人信息 业务处理
 *
 * @author Pontus
 */
@Validated
@AllArgsConstructor
@RestController
@RequestMapping("/system/user/profile")
public class SysProfileController extends BaseController {

    private final SysUserService sysUserService;
    private final SysOssService sysOssService;

    /**
     * 个人信息
     */
    @GetMapping
    public ApiResult<ProfileVo> profile() {
        SysUserVo user = sysUserService.selectUserById(LoginUserContext.getUserId());
        String roleGroup = sysUserService.selectUserRoleGroup(user.getUserId());
        String postGroup = sysUserService.selectUserPostGroup(user.getUserId());
        // 单独做一个vo专门给个人中心用 避免数据被脱敏
        ProfileUserVo profileUser = BeanUtil.toBean(user, ProfileUserVo.class);
        ProfileVo profileVo = new ProfileVo(profileUser, roleGroup, postGroup);
        return ApiResult.ok(profileVo);
    }

    /**
     * 修改用户信息
     */
    @RepeatSubmit
    @Log(title = "个人信息", businessType = BusinessType.UPDATE)
    @PutMapping
    public ApiResult<Void> updateProfile(@Validated @RequestBody SysUserProfileBo profile) {
        SysUserBo user = BeanUtil.toBean(profile, SysUserBo.class);
        user.setUserId(LoginUserContext.getUserId());
        String username = LoginUserContext.getUsername();
        if (StringUtils.isNotEmpty(user.getPhonenumber()) && !sysUserService.checkPhoneUnique(user)) {
            return ApiResult.fail("修改用户'" + username + "'失败，手机号码已存在");
        }
        if (StringUtils.isNotEmpty(user.getEmail()) && !sysUserService.checkEmailUnique(user)) {
            return ApiResult.fail("修改用户'" + username + "'失败，邮箱账号已存在");
        }
        int rows = DataPermissionHelper.ignore(() -> sysUserService.updateUserProfile(user));
        if (rows > 0) {
            return ApiResult.ok();
        }
        return ApiResult.fail("修改个人信息异常，请联系管理员");
    }

    /**
     * 重置密码
     *
     * @param bo 新旧密码
     */
    @RepeatSubmit
    @ApiEncrypt
    @Log(title = "个人信息", businessType = BusinessType.UPDATE)
    @PutMapping("/updatePwd")
    public ApiResult<Void> updatePwd(@Validated @RequestBody SysUserPasswordBo bo) {
        SysUserVo user = sysUserService.selectUserById(LoginUserContext.getUserId());
        String password = user.getPassword();
        if (!BCrypt.checkpw(bo.getOldPassword(), password)) {
            return ApiResult.fail("修改密码失败，旧密码错误");
        }
        if (BCrypt.checkpw(bo.getNewPassword(), password)) {
            return ApiResult.fail("新密码不能与旧密码相同");
        }
        int rows = DataPermissionHelper.ignore(() -> sysUserService.resetUserPwd(user.getUserId(), BCrypt.hashpw(bo.getNewPassword())));
        if (rows > 0) {
            return ApiResult.ok();
        }
        return ApiResult.fail("修改密码异常，请联系管理员");
    }

    /**
     * 头像上传
     *
     * @param avatarfile 用户头像
     */
    @RepeatSubmit
    @Log(title = "用户头像", businessType = BusinessType.UPDATE)
    @PostMapping(value = "/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResult<AvatarVo> avatar(@RequestPart("avatarfile") MultipartFile avatarfile) {
        if (ObjectUtil.isNotNull(avatarfile) && !avatarfile.isEmpty()) {
            String extension = FileUtil.extName(avatarfile.getOriginalFilename());
            if (!StringUtils.equalsAnyIgnoreCase(extension, MimeTypeUtils.IMAGE_EXTENSION)) {
                return ApiResult.fail("文件格式不正确，请上传" + Arrays.toString(MimeTypeUtils.IMAGE_EXTENSION) + "格式");
            }
            SysOssVo oss = sysOssService.upload(avatarfile);
            String avatar = oss.getUrl();
            boolean updateSuccess = DataPermissionHelper.ignore(() -> sysUserService.updateUserAvatar(LoginUserContext.getUserId(), oss.getOssId()));
            if (updateSuccess) {
                return ApiResult.ok(new AvatarVo(avatar));
            }
        }
        return ApiResult.fail("上传图片异常，请联系管理员");
    }

    /**
     * 用户头像信息
     *
     * @param imgUrl 头像地址
     */
    public record AvatarVo(String imgUrl) {}

    /**
     * 用户个人信息
     *
     * @param user      用户信息
     * @param roleGroup 用户所属角色组
     * @param postGroup 用户所属岗位组
     */
    public record ProfileVo(ProfileUserVo user, String roleGroup, String postGroup) {}

}
