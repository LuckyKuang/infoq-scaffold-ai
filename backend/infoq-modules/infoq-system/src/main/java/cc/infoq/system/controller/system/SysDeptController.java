package cc.infoq.system.controller.system;

import cc.infoq.common.constant.SystemConstants;
import cc.infoq.common.domain.ApiResult;
import cc.infoq.common.log.annotation.Log;
import cc.infoq.common.log.enums.BusinessType;
import cc.infoq.common.redis.annotation.RepeatSubmit;
import cc.infoq.common.utils.StringUtils;
import cc.infoq.common.web.core.BaseController;
import cc.infoq.system.domain.bo.SysDeptBo;
import cc.infoq.system.domain.vo.SysDeptVo;
import cc.infoq.system.service.SysDeptService;
import cc.infoq.system.service.SysPostService;
import cn.hutool.core.convert.Convert;
import lombok.AllArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 部门信息
 *
 * @author Pontus
 */
@Validated
@AllArgsConstructor
@RestController
@RequestMapping("/system/dept")
public class SysDeptController extends BaseController {

    private final SysDeptService sysDeptService;
    private final SysPostService sysPostService;

    /**
     * 获取部门列表
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:dept:list')")
    @GetMapping("/list")
    public ApiResult<List<SysDeptVo>> list(SysDeptBo dept) {
        List<SysDeptVo> depts = sysDeptService.selectDeptList(dept);
        return ApiResult.ok(depts);
    }

    /**
     * 查询部门列表（排除节点）
     *
     * @param deptId 部门ID
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:dept:list')")
    @GetMapping("/list/exclude/{deptId}")
    public ApiResult<List<SysDeptVo>> excludeChild(@PathVariable(value = "deptId", required = false) Long deptId) {
        List<SysDeptVo> depts = sysDeptService.selectDeptList(new SysDeptBo());
        depts.removeIf(d -> d.getDeptId().equals(deptId)
            || StringUtils.splitList(d.getAncestors()).contains(Convert.toStr(deptId)));
        return ApiResult.ok(depts);
    }

    /**
     * 根据部门编号获取详细信息
     *
     * @param deptId 部门ID
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:dept:query')")
    @GetMapping(value = "/{deptId}")
    public ApiResult<SysDeptVo> getInfo(@PathVariable Long deptId) {
        sysDeptService.checkDeptDataScope(deptId);
        return ApiResult.ok(sysDeptService.selectDeptById(deptId));
    }

    /**
     * 新增部门
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:dept:add')")
    @Log(title = "部门管理", businessType = BusinessType.INSERT)
    @RepeatSubmit()
    @PostMapping
    public ApiResult<Void> add(@Validated @RequestBody SysDeptBo dept) {
        if (!sysDeptService.checkDeptNameUnique(dept)) {
            return ApiResult.fail("新增部门'" + dept.getDeptName() + "'失败，部门名称已存在");
        }
        return toAjax(sysDeptService.insertDept(dept));
    }

    /**
     * 修改部门
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:dept:edit')")
    @Log(title = "部门管理", businessType = BusinessType.UPDATE)
    @RepeatSubmit()
    @PutMapping
    public ApiResult<Void> edit(@Validated @RequestBody SysDeptBo dept) {
        Long deptId = dept.getDeptId();
        sysDeptService.checkDeptDataScope(deptId);
        if (!sysDeptService.checkDeptNameUnique(dept)) {
            return ApiResult.fail("修改部门'" + dept.getDeptName() + "'失败，部门名称已存在");
        } else if (dept.getParentId().equals(deptId)) {
            return ApiResult.fail("修改部门'" + dept.getDeptName() + "'失败，上级部门不能是自己");
        } else if (StringUtils.equals(SystemConstants.DISABLE, dept.getStatus())) {
            if (sysDeptService.selectNormalChildrenDeptById(deptId) > 0) {
                return ApiResult.fail("该部门包含未停用的子部门!");
            } else if (sysDeptService.checkDeptExistUser(deptId)) {
                return ApiResult.fail("该部门下存在已分配用户，不能禁用!");
            }
        }
        return toAjax(sysDeptService.updateDept(dept));
    }

    /**
     * 删除部门
     *
     * @param deptId 部门ID
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:dept:remove')")
    @Log(title = "部门管理", businessType = BusinessType.DELETE)
    @DeleteMapping("/{deptId}")
    public ApiResult<Void> remove(@PathVariable Long deptId) {
        if (SystemConstants.DEFAULT_DEPT_ID.equals(deptId)) {
            return ApiResult.warn("默认部门,不允许删除");
        }
        if (sysDeptService.hasChildByDeptId(deptId)) {
            return ApiResult.warn("存在下级部门,不允许删除");
        }
        if (sysDeptService.checkDeptExistUser(deptId)) {
            return ApiResult.warn("部门存在用户,不允许删除");
        }
        if (sysPostService.countPostByDeptId(deptId) > 0) {
            return ApiResult.warn("部门存在岗位,不允许删除");
        }
        sysDeptService.checkDeptDataScope(deptId);
        return toAjax(sysDeptService.deleteDeptById(deptId));
    }

    /**
     * 获取部门选择框列表
     *
     * @param deptIds 部门ID串
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:dept:query')")
    @GetMapping("/optionselect")
    public ApiResult<List<SysDeptVo>> optionselect(@RequestParam(required = false) Long[] deptIds) {
        return ApiResult.ok(sysDeptService.selectDeptByIds(deptIds == null ? null : List.of(deptIds)));
    }

}
