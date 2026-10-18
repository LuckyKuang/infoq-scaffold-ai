package cc.infoq.system.controller.system;

import cc.infoq.common.domain.ApiResult;
import cc.infoq.common.log.annotation.Log;
import cc.infoq.common.log.enums.BusinessType;
import cc.infoq.common.mybatis.core.page.PageQuery;
import cc.infoq.common.mybatis.core.page.TableDataInfo;
import cc.infoq.common.redis.annotation.RepeatSubmit;
import cc.infoq.common.validate.AddGroup;
import cc.infoq.common.validate.EditGroup;
import cc.infoq.common.validate.QueryGroup;
import cc.infoq.common.validate.StatusGroup;
import cc.infoq.common.web.core.BaseController;
import cc.infoq.system.domain.bo.SysOssConfigBo;
import cc.infoq.system.domain.vo.SysOssConfigVo;
import cc.infoq.system.service.SysOssConfigService;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 对象存储配置
 *
 * @author Pontus
 */
@Validated
@AllArgsConstructor
@RestController
@RequestMapping("/resource/oss/config")
public class SysOssConfigController extends BaseController {

    private final SysOssConfigService sysOssConfigService;

    /**
     * 查询对象存储配置列表
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:ossConfig:list')")
    @GetMapping("/list")
    public TableDataInfo<SysOssConfigVo> list(@Validated(QueryGroup.class) SysOssConfigBo bo, PageQuery pageQuery) {
        return sysOssConfigService.queryPageList(bo, pageQuery);
    }

    /**
     * 获取对象存储配置详细信息
     *
     * @param ossConfigId OSS配置ID
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:ossConfig:list')")
    @GetMapping("/{ossConfigId}")
    public ApiResult<SysOssConfigVo> getInfo(@NotNull(message = "主键不能为空")
                                     @PathVariable Long ossConfigId) {
        return ApiResult.ok(sysOssConfigService.queryById(ossConfigId));
    }

    /**
     * 新增对象存储配置
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:ossConfig:add')")
    @Log(title = "对象存储配置", businessType = BusinessType.INSERT)
    @RepeatSubmit()
    @PostMapping()
    public ApiResult<Void> add(@Validated(AddGroup.class) @RequestBody SysOssConfigBo bo) {
        return toAjax(sysOssConfigService.insertByBo(bo));
    }

    /**
     * 修改对象存储配置
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:ossConfig:edit')")
    @Log(title = "对象存储配置", businessType = BusinessType.UPDATE)
    @RepeatSubmit()
    @PutMapping()
    public ApiResult<Void> edit(@Validated(EditGroup.class) @RequestBody SysOssConfigBo bo) {
        return toAjax(sysOssConfigService.updateByBo(bo));
    }

    /**
     * 删除对象存储配置
     *
     * @param ossConfigIds OSS配置ID串
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:ossConfig:remove')")
    @Log(title = "对象存储配置", businessType = BusinessType.DELETE)
    @DeleteMapping("/{ossConfigIds}")
    public ApiResult<Void> remove(@NotEmpty(message = "主键不能为空")
                          @PathVariable Long[] ossConfigIds) {
        return toAjax(sysOssConfigService.deleteWithValidByIds(List.of(ossConfigIds), true));
    }

    /**
     * 状态修改
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:ossConfig:edit')")
    @Log(title = "对象存储状态修改", businessType = BusinessType.UPDATE)
    @RepeatSubmit()
    @PutMapping("/changeStatus")
    public ApiResult<Void> changeStatus(@Validated(StatusGroup.class) @RequestBody SysOssConfigBo bo) {
        return toAjax(sysOssConfigService.updateOssConfigStatus(bo));
    }
}
