package cc.infoq.system.controller.monitor;

import cc.infoq.common.domain.ApiResult;
import cc.infoq.common.excel.utils.ExcelUtil;
import cc.infoq.common.log.annotation.Log;
import cc.infoq.common.log.enums.BusinessType;
import cc.infoq.common.mybatis.core.page.PageQuery;
import cc.infoq.common.mybatis.core.page.TableDataInfo;
import cc.infoq.common.web.core.BaseController;
import cc.infoq.system.domain.bo.SysOperLogBo;
import cc.infoq.system.domain.vo.SysOperLogVo;
import cc.infoq.system.service.SysOperLogService;
import com.baomidou.lock.annotation.Lock4j;
import jakarta.servlet.http.HttpServletResponse;
import lombok.AllArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 操作日志记录
 *
 * @author Pontus
 */
@Validated
@AllArgsConstructor
@RestController
@RequestMapping("/monitor/operLog")
public class SysOperLogController extends BaseController {

    private final SysOperLogService operLogService;

    /**
     * 获取操作日志记录列表
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('monitor:operLog:list')")
    @GetMapping("/list")
    public TableDataInfo<SysOperLogVo> list(SysOperLogBo operLog, PageQuery pageQuery) {
        return operLogService.selectPageOperLogList(operLog, pageQuery);
    }

    /**
     * 导出操作日志记录列表
     */
    @Log(title = "操作日志", businessType = BusinessType.EXPORT)
    @PreAuthorize("@securityAuthorizationService.hasPermission('monitor:operLog:export')")
    @PostMapping("/export")
    public void export(SysOperLogBo operLog, HttpServletResponse response) {
        List<SysOperLogVo> list = operLogService.selectOperLogList(operLog);
        ExcelUtil.exportExcel(list, "操作日志", SysOperLogVo.class, response);
    }

    /**
     * 批量删除操作日志记录
     * @param operIds 日志ids
     */
    @Log(title = "操作日志", businessType = BusinessType.DELETE)
    @PreAuthorize("@securityAuthorizationService.hasPermission('monitor:operLog:remove')")
    @DeleteMapping("/{operIds}")
    public ApiResult<Void> remove(@PathVariable Long[] operIds) {
        return toAjax(operLogService.deleteOperLogByIds(operIds));
    }

    /**
     * 清理操作日志记录
     */
    @Log(title = "操作日志", businessType = BusinessType.CLEAN)
    @PreAuthorize("@securityAuthorizationService.hasPermission('monitor:operLog:remove')")
    @Lock4j
    @DeleteMapping("/clean")
    public ApiResult<Void> clean() {
        operLogService.cleanOperLog();
        return ApiResult.ok();
    }
}
