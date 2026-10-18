package cc.infoq.system.controller.monitor;

import cc.infoq.common.constant.CacheConstants;
import cc.infoq.common.domain.ApiResult;
import cc.infoq.common.excel.utils.ExcelUtil;
import cc.infoq.common.log.annotation.Log;
import cc.infoq.common.log.enums.BusinessType;
import cc.infoq.common.mybatis.core.page.PageQuery;
import cc.infoq.common.mybatis.core.page.TableDataInfo;
import cc.infoq.common.redis.annotation.RepeatSubmit;
import cc.infoq.common.redis.utils.RedisUtils;
import cc.infoq.common.web.core.BaseController;
import cc.infoq.system.domain.bo.SysLoginInfoBo;
import cc.infoq.system.domain.vo.SysLoginInfoVo;
import cc.infoq.system.service.SysLoginInfoService;
import com.baomidou.lock.annotation.Lock4j;
import jakarta.servlet.http.HttpServletResponse;
import lombok.AllArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 系统访问记录
 *
 * @author Pontus
 */
@Validated
@AllArgsConstructor
@RestController
@RequestMapping("/monitor/loginInfo")
public class SysLoginInfoController extends BaseController {

    private final SysLoginInfoService loginInfoService;

    /**
     * 获取系统访问记录列表
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('monitor:loginInfo:list')")
    @GetMapping("/list")
    public TableDataInfo<SysLoginInfoVo> list(SysLoginInfoBo loginInfo, PageQuery pageQuery) {
        return loginInfoService.selectPageLoginInfoList(loginInfo, pageQuery);
    }

    /**
     * 导出系统访问记录列表
     */
    @Log(title = "登录日志", businessType = BusinessType.EXPORT)
    @PreAuthorize("@securityAuthorizationService.hasPermission('monitor:loginInfo:export')")
    @PostMapping("/export")
    public void export(SysLoginInfoBo loginInfo, HttpServletResponse response) {
        List<SysLoginInfoVo> list = loginInfoService.selectLoginInfoList(loginInfo);
        ExcelUtil.exportExcel(list, "登录日志", SysLoginInfoVo.class, response);
    }

    /**
     * 批量删除登录日志
     * @param infoIds 日志ids
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('monitor:loginInfo:remove')")
    @Log(title = "登录日志", businessType = BusinessType.DELETE)
    @DeleteMapping("/{infoIds}")
    public ApiResult<Void> remove(@PathVariable Long[] infoIds) {
        return toAjax(loginInfoService.deleteLoginInfoByIds(infoIds));
    }

    /**
     * 清理系统访问记录
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('monitor:loginInfo:remove')")
    @Log(title = "登录日志", businessType = BusinessType.CLEAN)
    @Lock4j
    @DeleteMapping("/clean")
    public ApiResult<Void> clean() {
        loginInfoService.cleanLoginInfo();
        return ApiResult.ok();
    }

    @PreAuthorize("@securityAuthorizationService.hasPermission('monitor:loginInfo:unlock')")
    @Log(title = "账户解锁", businessType = BusinessType.OTHER)
    @RepeatSubmit()
    @GetMapping("/unlock/{userName}")
    public ApiResult<Void> unlock(@PathVariable("userName") String userName) {
        String loginName = CacheConstants.PWD_ERR_CNT_KEY + userName;
        if (RedisUtils.hasKey(loginName)) {
            RedisUtils.deleteObject(loginName);
        }
        return ApiResult.ok();
    }

}
