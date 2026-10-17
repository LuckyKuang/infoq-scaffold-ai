package cc.infoq.system.controller.system;

import cc.infoq.common.constant.SystemConstants;
import cc.infoq.common.domain.ApiResult;
import cc.infoq.common.domain.model.LoginUser;
import cc.infoq.common.encrypt.annotation.ApiEncrypt;
import cc.infoq.common.excel.core.ExcelResult;
import cc.infoq.common.excel.utils.ExcelUtil;
import cc.infoq.common.log.annotation.Log;
import cc.infoq.common.log.enums.BusinessType;
import cc.infoq.common.mybatis.core.page.PageQuery;
import cc.infoq.common.mybatis.core.page.TableDataInfo;
import cc.infoq.common.mybatis.helper.DataPermissionHelper;
import cc.infoq.common.redis.annotation.RepeatSubmit;
import cc.infoq.common.security.auth.LoginUserContext;
import cc.infoq.common.utils.StreamUtils;
import cc.infoq.common.utils.StringUtils;
import cc.infoq.common.validate.ResetPwdGroup;
import cc.infoq.common.validate.StatusGroup;
import cc.infoq.common.web.core.BaseController;
import cc.infoq.system.domain.bo.SysDeptBo;
import cc.infoq.system.domain.bo.SysPostBo;
import cc.infoq.system.domain.bo.SysRoleBo;
import cc.infoq.system.domain.bo.SysUserBo;
import cc.infoq.system.domain.vo.*;
import cc.infoq.system.listener.SysUserImportListener;
import cc.infoq.system.service.SysDeptService;
import cc.infoq.system.service.SysPostService;
import cc.infoq.system.service.SysRoleService;
import cc.infoq.system.service.SysUserService;
import cn.hutool.core.lang.tree.Tree;
import cn.hutool.core.util.ArrayUtil;
import cn.hutool.core.util.ObjectUtil;
import cn.hutool.crypto.digest.BCrypt;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.List;

/**
 * 用户信息
 *
 * @author Pontus
 */
@Validated
@AllArgsConstructor
@RestController
@RequestMapping("/system/user")
public class SysUserController extends BaseController {

    private final SysUserService sysUserService;
    private final SysRoleService sysRoleService;
    private final SysPostService sysPostService;
    private final SysDeptService sysDeptService;

    /**
     * 获取用户列表
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:user:list')")
    @GetMapping("/list")
    public TableDataInfo<SysUserVo> list(SysUserBo user, PageQuery pageQuery) {
        return sysUserService.selectPageUserList(user, pageQuery);
    }

    /**
     * 导出用户列表
     */
    @Log(title = "用户管理", businessType = BusinessType.EXPORT)
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:user:export')")
    @PostMapping("/export")
    public void export(SysUserBo user, HttpServletResponse response) {
        List<SysUserExportVo> list = sysUserService.selectUserExportList(user);
        ExcelUtil.exportExcel(list, "用户数据", SysUserExportVo.class, response);
    }

    /**
     * 导入数据
     *
     * @param file          导入文件
     * @param updateSupport 是否更新已存在数据
     */
    @Log(title = "用户管理", businessType = BusinessType.IMPORT)
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:user:import')")
    @PostMapping(value = "/importData", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResult<Void> importData(@RequestPart("file") MultipartFile file, boolean updateSupport) throws Exception {
        ExcelResult<SysUserImportVo> result = ExcelUtil.importExcel(file.getInputStream(), SysUserImportVo.class, new SysUserImportListener(updateSupport));
        return ApiResult.ok(result.getAnalysis());
    }

    /**
     * 获取导入模板
     */
    @PostMapping("/importTemplate")
    public void importTemplate(HttpServletResponse response) {
        ExcelUtil.exportExcel(new ArrayList<>(), "用户数据", SysUserImportVo.class, response);
    }

    /**
     * 获取用户信息
     *
     * @return 用户信息
     */
    @GetMapping("/getInfo")
    public ApiResult<UserInfoVo> getInfo() {
        UserInfoVo userInfoVo = new UserInfoVo();
        LoginUser loginUser = LoginUserContext.getLoginUser();
        SysUserVo user = DataPermissionHelper.ignore(() -> sysUserService.selectUserById(loginUser.getUserId()));
        if (ObjectUtil.isNull(user)) {
            return ApiResult.fail("没有权限访问用户数据!");
        }
        userInfoVo.setUser(user);
        userInfoVo.setPermissions(loginUser.getMenuPermission());
        userInfoVo.setRoles(loginUser.getRolePermission());
        return ApiResult.ok(userInfoVo);
    }

    /**
     * 根据用户编号获取详细信息
     *
     * @param userId 用户ID
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:user:query')")
    @GetMapping(value = {"/", "/{userId}"})
    public ApiResult<SysUserInfoVo> getInfo(@PathVariable(value = "userId", required = false) Long userId) {
        SysUserInfoVo userInfoVo = new SysUserInfoVo();
        if (ObjectUtil.isNotNull(userId)) {
            sysUserService.checkUserDataScope(userId);
            SysUserVo sysUser = sysUserService.selectUserById(userId);
            userInfoVo.setUser(sysUser);
            userInfoVo.setRoleIds(sysRoleService.selectRoleListByUserId(userId));
            Long deptId = sysUser.getDeptId();
            if (ObjectUtil.isNotNull(deptId)) {
                SysPostBo postBo = new SysPostBo();
                postBo.setDeptId(deptId);
                userInfoVo.setPosts(sysPostService.selectPostList(postBo));
                userInfoVo.setPostIds(sysPostService.selectPostListByUserId(userId));
            }
        }
        SysRoleBo roleBo = new SysRoleBo();
        roleBo.setStatus(SystemConstants.NORMAL);
        List<SysRoleVo> roles = sysRoleService.selectRoleList(roleBo);
        userInfoVo.setRoles(LoginUserContext.isSuperAdmin(userId) ? roles : StreamUtils.filter(roles, r -> !r.isSuperAdmin()));
        return ApiResult.ok(userInfoVo);
    }

    /**
     * 新增用户
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:user:add')")
    @Log(title = "用户管理", businessType = BusinessType.INSERT)
    @RepeatSubmit()
    @PostMapping
    public ApiResult<Void> add(@Validated @RequestBody SysUserBo user) {
        sysDeptService.checkDeptDataScope(user.getDeptId());
        if (!sysUserService.checkUserNameUnique(user)) {
            return ApiResult.fail("新增用户'" + user.getUserName() + "'失败，登录账号已存在");
        } else if (StringUtils.isNotEmpty(user.getPhonenumber()) && !sysUserService.checkPhoneUnique(user)) {
            return ApiResult.fail("新增用户'" + user.getUserName() + "'失败，手机号码已存在");
        } else if (StringUtils.isNotEmpty(user.getEmail()) && !sysUserService.checkEmailUnique(user)) {
            return ApiResult.fail("新增用户'" + user.getUserName() + "'失败，邮箱账号已存在");
        }
        user.setPassword(BCrypt.hashpw(user.getPassword()));
        return toAjax(sysUserService.insertUser(user));
    }

    /**
     * 修改用户
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:user:edit')")
    @Log(title = "用户管理", businessType = BusinessType.UPDATE)
    @RepeatSubmit()
    @PutMapping
    public ApiResult<Void> edit(@Validated @RequestBody SysUserBo user) {
        sysUserService.checkUserAllowed(user.getUserId());
        sysUserService.checkUserDataScope(user.getUserId());
        sysDeptService.checkDeptDataScope(user.getDeptId());
        if (!sysUserService.checkUserNameUnique(user)) {
            return ApiResult.fail("修改用户'" + user.getUserName() + "'失败，登录账号已存在");
        } else if (StringUtils.isNotEmpty(user.getPhonenumber()) && !sysUserService.checkPhoneUnique(user)) {
            return ApiResult.fail("修改用户'" + user.getUserName() + "'失败，手机号码已存在");
        } else if (StringUtils.isNotEmpty(user.getEmail()) && !sysUserService.checkEmailUnique(user)) {
            return ApiResult.fail("修改用户'" + user.getUserName() + "'失败，邮箱账号已存在");
        }
        return toAjax(sysUserService.updateUser(user));
    }

    /**
     * 删除用户
     *
     * @param userIds 角色ID串
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:user:remove')")
    @Log(title = "用户管理", businessType = BusinessType.DELETE)
    @DeleteMapping("/{userIds}")
    public ApiResult<Void> remove(@PathVariable Long[] userIds) {
        if (ArrayUtil.contains(userIds, LoginUserContext.getUserId())) {
            return ApiResult.fail("当前用户不能删除");
        }
        return toAjax(sysUserService.deleteUserByIds(userIds));
    }

    /**
     * 根据用户ID串批量获取用户基础信息
     *
     * @param userIds 用户ID串
     * @param deptId  部门ID
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:user:query')")
    @GetMapping("/optionselect")
    public ApiResult<List<SysUserVo>> optionselect(@RequestParam(required = false) Long[] userIds,
                                                   @RequestParam(required = false) Long deptId) {
        return ApiResult.ok(sysUserService.selectUserByIds(ArrayUtil.isEmpty(userIds) ? null : List.of(userIds), deptId));
    }

    /**
     * 重置密码
     */
    @ApiEncrypt
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:user:resetPwd')")
    @Log(title = "用户管理", businessType = BusinessType.UPDATE)
    @RepeatSubmit()
    @PutMapping("/resetPwd")
    public ApiResult<Void> resetPwd(@Validated(ResetPwdGroup.class) @RequestBody SysUserBo user) {
        sysUserService.checkUserAllowed(user.getUserId());
        sysUserService.checkUserDataScope(user.getUserId());
        user.setPassword(BCrypt.hashpw(user.getPassword()));
        return toAjax(sysUserService.resetUserPwd(user.getUserId(), user.getPassword()));
    }

    /**
     * 状态修改
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:user:edit')")
    @Log(title = "用户管理", businessType = BusinessType.UPDATE)
    @RepeatSubmit()
    @PutMapping("/changeStatus")
    public ApiResult<Void> changeStatus(@Validated(StatusGroup.class) @RequestBody SysUserBo user) {
        sysUserService.checkUserAllowed(user.getUserId());
        sysUserService.checkUserDataScope(user.getUserId());
        return toAjax(sysUserService.updateUserStatus(user.getUserId(), user.getStatus()));
    }

    /**
     * 根据用户编号获取授权角色
     *
     * @param userId 用户ID
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:user:query')")
    @GetMapping("/authRole/{userId}")
    public ApiResult<SysUserInfoVo> authRole(@PathVariable Long userId) {
        sysUserService.checkUserDataScope(userId);
        SysUserVo user = sysUserService.selectUserById(userId);
        List<SysRoleVo> roles = sysRoleService.selectRolesAuthByUserId(userId);
        SysUserInfoVo userInfoVo = new SysUserInfoVo();
        userInfoVo.setUser(user);
        userInfoVo.setRoles(LoginUserContext.isSuperAdmin(userId) ? roles : StreamUtils.filter(roles, r -> !r.isSuperAdmin()));
        return ApiResult.ok(userInfoVo);
    }

    /**
     * 用户授权角色
     *
     * @param userId  用户Id
     * @param roleIds 角色ID串
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:user:edit')")
    @Log(title = "用户管理", businessType = BusinessType.GRANT)
    @RepeatSubmit()
    @PutMapping("/authRole")
    public ApiResult<Void> insertAuthRole(Long userId, Long[] roleIds) {
        sysUserService.checkUserDataScope(userId);
        sysUserService.insertUserAuth(userId, roleIds);
        return ApiResult.ok();
    }

    /**
     * 获取部门树列表
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:user:list')")
    @GetMapping("/deptTree")
    public ApiResult<List<Tree<Long>>> deptTree(SysDeptBo dept) {
        return ApiResult.ok(sysDeptService.selectDeptTreeList(dept));
    }

    /**
     * 获取部门下的所有用户信息
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:user:list')")
    @GetMapping("/list/dept/{deptId}")
    public ApiResult<List<SysUserVo>> listByDept(@PathVariable @NotNull Long deptId) {
        return ApiResult.ok(sysUserService.selectUserListByDept(deptId));
    }

}
