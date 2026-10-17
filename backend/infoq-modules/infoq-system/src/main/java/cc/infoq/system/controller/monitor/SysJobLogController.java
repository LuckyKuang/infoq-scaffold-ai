package cc.infoq.system.controller.monitor;

import cc.infoq.common.domain.ApiResult;
import cc.infoq.common.excel.utils.ExcelUtil;
import cc.infoq.common.log.annotation.Log;
import cc.infoq.common.log.enums.BusinessType;
import cc.infoq.common.mybatis.core.page.PageQuery;
import cc.infoq.common.mybatis.core.page.TableDataInfo;
import cc.infoq.common.web.core.BaseController;
import cc.infoq.system.domain.bo.SysJobLogBo;
import cc.infoq.system.domain.vo.SysJobLogVo;
import cc.infoq.system.service.SysJobLogService;
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
 * 定时任务日志管理
 *
 * @author Pontus
 */
@Validated
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "infoq.quartz", name = "enabled", havingValue = "true", matchIfMissing = true)
@RequestMapping("/monitor/jobLog")
public class SysJobLogController extends BaseController {

    private final SysJobLogService sysJobLogService;

    @PreAuthorize("@securityAuthorizationService.hasPermission('monitor:jobLog:list')")
    @GetMapping("/list")
    public TableDataInfo<SysJobLogVo> list(SysJobLogBo bo, PageQuery pageQuery) {
        return sysJobLogService.queryPageList(bo, pageQuery);
    }

    @PreAuthorize("@securityAuthorizationService.hasPermission('monitor:jobLog:export')")
    @Log(title = "定时任务日志", businessType = BusinessType.EXPORT)
    @PostMapping("/export")
    public void export(SysJobLogBo bo, HttpServletResponse response) {
        List<SysJobLogVo> list = sysJobLogService.queryList(bo);
        ExcelUtil.exportExcel(list, "定时任务日志", SysJobLogVo.class, response);
    }

    @PreAuthorize("@securityAuthorizationService.hasPermission('monitor:jobLog:query')")
    @GetMapping("/{jobLogId}")
    public ApiResult<SysJobLogVo> getInfo(@NotNull(message = "日志ID不能为空") @PathVariable Long jobLogId) {
        return ApiResult.ok(sysJobLogService.queryById(jobLogId));
    }

    @PreAuthorize("@securityAuthorizationService.hasPermission('monitor:jobLog:remove')")
    @Log(title = "定时任务日志", businessType = BusinessType.DELETE)
    @DeleteMapping("/{jobLogIds}")
    public ApiResult<Void> remove(@NotEmpty(message = "日志ID不能为空") @PathVariable Long[] jobLogIds) {
        return toAjax(sysJobLogService.deleteByIds(jobLogIds));
    }

    @PreAuthorize("@securityAuthorizationService.hasPermission('monitor:jobLog:remove')")
    @Log(title = "定时任务日志", businessType = BusinessType.CLEAN)
    @DeleteMapping("/clean")
    public ApiResult<Void> clean() {
        sysJobLogService.clean();
        return ApiResult.ok();
    }
}
