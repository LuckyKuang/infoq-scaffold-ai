package cc.infoq.system.controller.monitor;

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
import cc.infoq.system.domain.bo.SysJobBo;
import cc.infoq.system.domain.vo.SysJobVo;
import cc.infoq.system.service.SysJobService;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 定时任务管理
 *
 * @author Pontus
 */
@Validated
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "infoq.quartz", name = "enabled", havingValue = "true", matchIfMissing = true)
@RequestMapping("/monitor/job")
public class SysJobController extends BaseController {

    private final SysJobService sysJobService;

    @PreAuthorize("@securityAuthorizationService.hasPermission('monitor:job:list')")
    @GetMapping("/list")
    public TableDataInfo<SysJobVo> list(SysJobBo bo, PageQuery pageQuery) {
        return sysJobService.queryPageList(bo, pageQuery);
    }

    @PreAuthorize("@securityAuthorizationService.hasPermission('monitor:job:export')")
    @Log(title = "定时任务", businessType = BusinessType.EXPORT)
    @PostMapping("/export")
    public void export(SysJobBo bo, HttpServletResponse response) {
        List<SysJobVo> list = sysJobService.queryList(bo);
        ExcelUtil.exportExcel(list, "定时任务", SysJobVo.class, response);
    }

    @PreAuthorize("@securityAuthorizationService.hasPermission('monitor:job:query')")
    @GetMapping("/{jobId}")
    public ApiResult<SysJobVo> getInfo(@NotNull(message = "任务ID不能为空") @PathVariable Long jobId) {
        return ApiResult.ok(sysJobService.queryById(jobId));
    }

    @PreAuthorize("@securityAuthorizationService.hasPermission('monitor:job:query')")
    @GetMapping("/handlerKeys")
    public ApiResult<List<String>> handlerKeys() {
        return ApiResult.ok(sysJobService.listHandlerKeys());
    }

    @PreAuthorize("@securityAuthorizationService.hasPermission('monitor:job:add')")
    @Log(title = "定时任务", businessType = BusinessType.INSERT)
    @RepeatSubmit()
    @PostMapping
    public ApiResult<Void> add(@Validated(AddGroup.class) @RequestBody SysJobBo bo) {
        return toAjax(sysJobService.insertByBo(bo));
    }

    @PreAuthorize("@securityAuthorizationService.hasPermission('monitor:job:edit')")
    @Log(title = "定时任务", businessType = BusinessType.UPDATE)
    @RepeatSubmit()
    @PutMapping
    public ApiResult<Void> edit(@Validated(EditGroup.class) @RequestBody SysJobBo bo) {
        return toAjax(sysJobService.updateByBo(bo));
    }

    @PreAuthorize("@securityAuthorizationService.hasPermission('monitor:job:changeStatus')")
    @Log(title = "定时任务", businessType = BusinessType.UPDATE)
    @PutMapping("/changeStatus")
    public ApiResult<Void> changeStatus(@Validated(StatusGroup.class) @RequestBody SysJobBo bo) {
        return toAjax(sysJobService.changeStatus(bo));
    }

    @PreAuthorize("@securityAuthorizationService.hasPermission('monitor:job:run')")
    @Log(title = "定时任务", businessType = BusinessType.UPDATE)
    @PutMapping("/run/{jobId}")
    public ApiResult<Void> run(@PathVariable Long jobId) {
        return toAjax(sysJobService.runNow(jobId));
    }

    @PreAuthorize("@securityAuthorizationService.hasPermission('monitor:job:remove')")
    @Log(title = "定时任务", businessType = BusinessType.DELETE)
    @DeleteMapping("/{jobIds}")
    public ApiResult<Void> remove(@NotEmpty(message = "任务ID不能为空") @PathVariable Long[] jobIds) {
        return toAjax(sysJobService.deleteByIds(jobIds));
    }
}
