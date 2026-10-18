package cc.infoq.system.controller.system;

import cc.infoq.common.domain.ApiResult;
import cc.infoq.common.excel.utils.ExcelUtil;
import cc.infoq.common.log.annotation.Log;
import cc.infoq.common.log.enums.BusinessType;
import cc.infoq.common.mybatis.core.page.PageQuery;
import cc.infoq.common.mybatis.core.page.TableDataInfo;
import cc.infoq.common.redis.annotation.RepeatSubmit;
import cc.infoq.common.validate.DataScopeGroup;
import cc.infoq.common.validate.GrantGroup;
import cc.infoq.common.validate.StatusGroup;
import cc.infoq.common.web.core.BaseController;
import cc.infoq.system.domain.bo.SysDeptBo;
import cc.infoq.system.domain.bo.SysRoleBo;
import cc.infoq.system.domain.bo.SysUserBo;
import cc.infoq.system.domain.entity.SysUserRole;
import cc.infoq.system.domain.vo.SysRoleVo;
import cc.infoq.system.domain.vo.SysUserVo;
import cc.infoq.system.service.SysDeptService;
import cc.infoq.system.service.SysRoleService;
import cc.infoq.system.service.SysUserService;
import cn.hutool.core.lang.tree.Tree;
import jakarta.servlet.http.HttpServletResponse;
import lombok.AllArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 角色信息
 *
 * @author Pontus
 */
@Validated
@AllArgsConstructor
@RestController
@RequestMapping("/system/role")
public class SysRoleController extends BaseController {

    private final SysRoleService sysRoleService;
    private final SysUserService sysUserService;
    private final SysDeptService sysDeptService;

    /**
     * 获取角色信息列表
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:role:list')")
    @GetMapping("/list")
    public TableDataInfo<SysRoleVo> list(SysRoleBo role, PageQuery pageQuery) {
        return sysRoleService.selectPageRoleList(role, pageQuery);
    }

    /**
     * 导出角色信息列表
     */
    @Log(title = "角色管理", businessType = BusinessType.EXPORT)
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:role:export')")
    @PostMapping("/export")
    public void export(SysRoleBo role, HttpServletResponse response) {
        List<SysRoleVo> list = sysRoleService.selectRoleList(role);
        ExcelUtil.exportExcel(list, "角色数据", SysRoleVo.class, response);
    }

    /**
     * 根据角色编号获取详细信息
     *
     * @param roleId 角色ID
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:role:query')")
    @GetMapping(value = "/{roleId}")
    public ApiResult<SysRoleVo> getInfo(@PathVariable Long roleId) {
        sysRoleService.checkRoleDataScope(roleId);
        return ApiResult.ok(sysRoleService.selectRoleById(roleId));
    }

    /**
     * 新增角色
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:role:add')")
    @Log(title = "角色管理", businessType = BusinessType.INSERT)
    @RepeatSubmit()
    @PostMapping
    public ApiResult<Void> add(@Validated @RequestBody SysRoleBo role) {
        sysRoleService.checkRoleAllowed(role);
        if (!sysRoleService.checkRoleNameUnique(role)) {
            return ApiResult.fail("新增角色'" + role.getRoleName() + "'失败，角色名称已存在");
        } else if (!sysRoleService.checkRoleKeyUnique(role)) {
            return ApiResult.fail("新增角色'" + role.getRoleName() + "'失败，角色权限已存在");
        }
        return toAjax(sysRoleService.insertRole(role));

    }

    /**
     * 修改保存角色
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:role:edit')")
    @Log(title = "角色管理", businessType = BusinessType.UPDATE)
    @RepeatSubmit()
    @PutMapping
    public ApiResult<Void> edit(@Validated @RequestBody SysRoleBo role) {
        sysRoleService.checkRoleAllowed(role);
        sysRoleService.checkRoleDataScope(role.getRoleId());
        if (!sysRoleService.checkRoleNameUnique(role)) {
            return ApiResult.fail("修改角色'" + role.getRoleName() + "'失败，角色名称已存在");
        } else if (!sysRoleService.checkRoleKeyUnique(role)) {
            return ApiResult.fail("修改角色'" + role.getRoleName() + "'失败，角色权限已存在");
        }

        if (sysRoleService.updateRole(role) > 0) {
            sysRoleService.cleanOnlineUserByRole(role.getRoleId());
            return ApiResult.ok();
        }
        return ApiResult.fail("修改角色'" + role.getRoleName() + "'失败，请联系管理员");
    }

    /**
     * 修改保存数据权限
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:role:edit')")
    @Log(title = "角色管理", businessType = BusinessType.UPDATE)
    @RepeatSubmit()
    @PutMapping("/dataScope")
    public ApiResult<Void> dataScope(@Validated(DataScopeGroup.class) @RequestBody SysRoleBo role) {
        sysRoleService.checkRoleAllowed(role);
        sysRoleService.checkRoleDataScope(role.getRoleId());
        return toAjax(sysRoleService.authDataScope(role));
    }

    /**
     * 状态修改
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:role:edit')")
    @Log(title = "角色管理", businessType = BusinessType.UPDATE)
    @RepeatSubmit()
    @PutMapping("/changeStatus")
    public ApiResult<Void> changeStatus(@Validated(StatusGroup.class) @RequestBody SysRoleBo role) {
        sysRoleService.checkRoleAllowed(role);
        sysRoleService.checkRoleDataScope(role.getRoleId());
        return toAjax(sysRoleService.updateRoleStatus(role.getRoleId(), role.getStatus()));
    }

    /**
     * 删除角色
     *
     * @param roleIds 角色ID串
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:role:remove')")
    @Log(title = "角色管理", businessType = BusinessType.DELETE)
    @DeleteMapping("/{roleIds}")
    public ApiResult<Void> remove(@PathVariable Long[] roleIds) {
        return toAjax(sysRoleService.deleteRoleByIds(List.of(roleIds)));
    }

    /**
     * 获取角色选择框列表
     *
     * @param roleIds 角色ID串
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:role:query')")
    @GetMapping("/optionselect")
    public ApiResult<List<SysRoleVo>> optionselect(@RequestParam(required = false) Long[] roleIds) {
        return ApiResult.ok(sysRoleService.selectRoleByIds(roleIds == null ? null : List.of(roleIds)));
    }

    /**
     * 查询已分配用户角色列表
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:role:list')")
    @GetMapping("/authUser/allocatedList")
    public TableDataInfo<SysUserVo> allocatedList(SysUserBo user, PageQuery pageQuery) {
        return sysUserService.selectAllocatedList(user, pageQuery);
    }

    /**
     * 查询未分配用户角色列表
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:role:list')")
    @GetMapping("/authUser/unallocatedList")
    public TableDataInfo<SysUserVo> unallocatedList(SysUserBo user, PageQuery pageQuery) {
        return sysUserService.selectUnallocatedList(user, pageQuery);
    }

    /**
     * 取消授权用户
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:role:edit')")
    @Log(title = "角色管理", businessType = BusinessType.GRANT)
    @RepeatSubmit()
    @PutMapping("/authUser/cancel")
    public ApiResult<Void> cancelAuthUser(@Validated(GrantGroup.class) @RequestBody SysUserRole userRole) {
        return toAjax(sysRoleService.deleteAuthUser(userRole));
    }

    /**
     * 批量取消授权用户
     *
     * @param roleId  角色ID
     * @param userIds 用户ID串
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:role:edit')")
    @Log(title = "角色管理", businessType = BusinessType.GRANT)
    @RepeatSubmit()
    @PutMapping("/authUser/cancelAll")
    public ApiResult<Void> cancelAuthUserAll(Long roleId, Long[] userIds) {
        return toAjax(sysRoleService.deleteAuthUsers(roleId, userIds));
    }

    /**
     * 批量选择用户授权
     *
     * @param roleId  角色ID
     * @param userIds 用户ID串
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:role:edit')")
    @Log(title = "角色管理", businessType = BusinessType.GRANT)
    @RepeatSubmit()
    @PutMapping("/authUser/selectAll")
    public ApiResult<Void> selectAuthUserAll(Long roleId, Long[] userIds) {
        sysRoleService.checkRoleDataScope(roleId);
        return toAjax(sysRoleService.insertAuthUsers(roleId, userIds));
    }

    /**
     * 获取对应角色部门树列表
     *
     * @param roleId 角色ID
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:role:list')")
    @GetMapping(value = "/deptTree/{roleId}")
    public ApiResult<DeptTreeSelectVo> roleDeptTreeselect(@PathVariable("roleId") Long roleId) {
        DeptTreeSelectVo selectVo = new DeptTreeSelectVo(
            sysDeptService.selectDeptListByRoleId(roleId),
            sysDeptService.selectDeptTreeList(new SysDeptBo()));
        return ApiResult.ok(selectVo);
    }

    /**
     * 角色部门列表树信息
     *
     * @param checkedKeys 选中部门列表
     * @param depts       下拉树结构列表
     */
    public record DeptTreeSelectVo(List<Long> checkedKeys, List<Tree<Long>> depts) {}

}
