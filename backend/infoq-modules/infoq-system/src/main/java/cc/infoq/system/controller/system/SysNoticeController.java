package cc.infoq.system.controller.system;

import cc.infoq.common.domain.ApiResult;
import cc.infoq.common.log.annotation.Log;
import cc.infoq.common.log.enums.BusinessType;
import cc.infoq.common.mybatis.core.page.PageQuery;
import cc.infoq.common.mybatis.core.page.TableDataInfo;
import cc.infoq.common.redis.annotation.RepeatSubmit;
import cc.infoq.common.web.core.BaseController;
import cc.infoq.system.domain.bo.SysNoticeBo;
import cc.infoq.system.domain.vo.SysNoticeVo;
import cc.infoq.system.service.SysNoticeService;
import lombok.AllArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

/**
 * 公告 信息操作处理
 *
 * @author Pontus
 */
@Validated
@AllArgsConstructor
@RestController
@RequestMapping("/system/notice")
public class SysNoticeController extends BaseController {

    private final SysNoticeService sysNoticeService;

    /**
     * 获取通知公告列表
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:notice:list')")
    @GetMapping("/list")
    public TableDataInfo<SysNoticeVo> list(SysNoticeBo notice, PageQuery pageQuery) {
        return sysNoticeService.selectPageNoticeList(notice, pageQuery);
    }

    /**
     * 根据通知公告编号获取详细信息
     *
     * @param noticeId 公告ID
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:notice:query')")
    @GetMapping(value = "/{noticeId}")
    public ApiResult<SysNoticeVo> getInfo(@PathVariable Long noticeId) {
        return ApiResult.ok(sysNoticeService.selectNoticeById(noticeId));
    }

    /**
     * 新增通知公告
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:notice:add')")
    @Log(title = "通知公告", businessType = BusinessType.INSERT)
    @RepeatSubmit()
    @PostMapping
    public ApiResult<Void> add(@Validated @RequestBody SysNoticeBo notice) {
        int rows = sysNoticeService.insertNotice(notice);
        if (rows <= 0) {
            return ApiResult.fail();
        }
        return ApiResult.ok();
    }

    /**
     * 修改通知公告
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:notice:edit')")
    @Log(title = "通知公告", businessType = BusinessType.UPDATE)
    @RepeatSubmit()
    @PutMapping
    public ApiResult<Void> edit(@Validated @RequestBody SysNoticeBo notice) {
        return toAjax(sysNoticeService.updateNotice(notice));
    }

    /**
     * 删除通知公告
     *
     * @param noticeIds 公告ID串
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:notice:remove')")
    @Log(title = "通知公告", businessType = BusinessType.DELETE)
    @DeleteMapping("/{noticeIds}")
    public ApiResult<Void> remove(@PathVariable Long[] noticeIds) {
        return toAjax(sysNoticeService.deleteNoticeByIds(noticeIds));
    }
}
