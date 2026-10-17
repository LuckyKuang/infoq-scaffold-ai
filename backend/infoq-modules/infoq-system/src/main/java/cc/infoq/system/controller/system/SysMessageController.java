package cc.infoq.system.controller.system;

import cc.infoq.common.domain.ApiResult;
import cc.infoq.common.log.annotation.Log;
import cc.infoq.common.log.enums.BusinessType;
import cc.infoq.common.mybatis.core.page.PageQuery;
import cc.infoq.common.mybatis.core.page.TableDataInfo;
import cc.infoq.common.security.auth.LoginUserContext;
import cc.infoq.system.domain.bo.SysMessageQueryBo;
import cc.infoq.system.domain.vo.SysMessageRecipientVo;
import cc.infoq.system.service.SysMessageService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/system/message")
public class SysMessageController {
    private final SysMessageService messageService;
    @GetMapping("/list") public TableDataInfo<SysMessageRecipientVo> list(SysMessageQueryBo query, PageQuery pageQuery) { return messageService.selectCurrentUserPage(LoginUserContext.getUserId(), query, pageQuery); }
    @GetMapping("/unread-count") public ApiResult<Long> unreadCount() { return ApiResult.ok(messageService.countUnread(LoginUserContext.getUserId())); }
    @Log(title = "个人消息", businessType = BusinessType.UPDATE) @PostMapping("/{messageId}/read") public ApiResult<Void> read(@PathVariable Long messageId) { messageService.markRead(LoginUserContext.getUserId(), messageId); return ApiResult.ok(); }
    @Log(title = "个人消息", businessType = BusinessType.UPDATE) @PostMapping("/read-all") public ApiResult<Void> readAll() { messageService.markAllRead(LoginUserContext.getUserId()); return ApiResult.ok(); }
    @Log(title = "个人消息", businessType = BusinessType.DELETE) @DeleteMapping("/{messageIds}") public ApiResult<Void> delete(@PathVariable Long[] messageIds) { messageService.deleteByMessageIds(LoginUserContext.getUserId(), messageIds); return ApiResult.ok(); }
}
