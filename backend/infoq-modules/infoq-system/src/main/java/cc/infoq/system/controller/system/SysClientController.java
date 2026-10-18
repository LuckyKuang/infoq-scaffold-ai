package cc.infoq.system.controller.system;

import cc.infoq.common.domain.ApiResult;
import cc.infoq.common.excel.utils.ExcelUtil;
import cc.infoq.common.log.annotation.Log;
import cc.infoq.common.log.enums.BusinessType;
import cc.infoq.common.mybatis.core.page.PageQuery;
import cc.infoq.common.mybatis.core.page.TableDataInfo;
import cc.infoq.common.redis.annotation.RepeatSubmit;
import cc.infoq.common.validate.AddGroup;
import cc.infoq.common.validate.EditGroup;
import cc.infoq.common.validate.StatusGroup;
import cc.infoq.common.web.core.BaseController;
import cc.infoq.system.domain.bo.SysClientBo;
import cc.infoq.system.domain.vo.SysClientVo;
import cc.infoq.system.service.SysClientService;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 客户端管理
 *
 * @author Pontus
 */
@Validated
@AllArgsConstructor
@RestController
@RequestMapping("/system/client")
public class SysClientController extends BaseController {

    private final SysClientService sysClientService;

    /**
     * 查询客户端管理列表
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:client:list')")
    @GetMapping("/list")
    public TableDataInfo<SysClientVo> list(SysClientBo bo, PageQuery pageQuery) {
        return sysClientService.queryPageList(bo, pageQuery);
    }

    /**
     * 导出客户端管理列表
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:client:export')")
    @Log(title = "客户端管理", businessType = BusinessType.EXPORT)
    @PostMapping("/export")
    public void export(SysClientBo bo, HttpServletResponse response) {
        List<SysClientVo> list = sysClientService.queryList(bo);
        ExcelUtil.exportExcel(list, "客户端管理", SysClientVo.class, response);
    }

    /**
     * 获取客户端管理详细信息
     *
     * @param id 主键
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:client:query')")
    @GetMapping("/{id}")
    public ApiResult<SysClientVo> getInfo(@NotNull(message = "主键不能为空")
                                  @PathVariable Long id) {
        return ApiResult.ok(sysClientService.queryById(id));
    }

    /**
     * 新增客户端管理
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:client:add')")
    @Log(title = "客户端管理", businessType = BusinessType.INSERT)
    @RepeatSubmit()
    @PostMapping()
    public ApiResult<Void> add(@Validated(AddGroup.class) @RequestBody SysClientBo bo) {
        if (!sysClientService.checkClickKeyUnique(bo)) {
            return ApiResult.fail("新增客户端'" + bo.getClientKey() + "'失败，客户端key已存在");
        }
        return toAjax(sysClientService.insertByBo(bo));
    }

    /**
     * 修改客户端管理
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:client:edit')")
    @Log(title = "客户端管理", businessType = BusinessType.UPDATE)
    @RepeatSubmit()
    @PutMapping()
    public ApiResult<Void> edit(@Validated(EditGroup.class) @RequestBody SysClientBo bo) {
        if (!sysClientService.checkClickKeyUnique(bo)) {
            return ApiResult.fail("修改客户端'" + bo.getClientKey() + "'失败，客户端key已存在");
        }
        return toAjax(sysClientService.updateByBo(bo));
    }

    /**
     * 状态修改
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:client:edit')")
    @Log(title = "客户端管理", businessType = BusinessType.UPDATE)
    @PutMapping("/changeStatus")
    public ApiResult<Void> changeStatus(@Validated(StatusGroup.class) @RequestBody SysClientBo bo) {
        return toAjax(sysClientService.updateClientStatus(bo.getClientId(), bo.getStatus()));
    }

    /**
     * 删除客户端管理
     *
     * @param ids 主键串
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:client:remove')")
    @Log(title = "客户端管理", businessType = BusinessType.DELETE)
    @DeleteMapping("/{ids}")
    public ApiResult<Void> remove(@NotEmpty(message = "主键不能为空")
                          @PathVariable Long[] ids) {
        return toAjax(sysClientService.deleteWithValidByIds(List.of(ids), true));
    }
}
