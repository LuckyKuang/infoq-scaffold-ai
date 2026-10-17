package cc.infoq.system.controller.system;


import cc.infoq.common.domain.ApiResult;
import cc.infoq.common.log.annotation.Log;
import cc.infoq.common.log.enums.BusinessType;
import cc.infoq.common.mybatis.core.page.PageQuery;
import cc.infoq.common.mybatis.core.page.TableDataInfo;
import cc.infoq.common.validate.QueryGroup;
import cc.infoq.common.web.core.BaseController;
import cc.infoq.system.domain.bo.SysOssBo;
import cc.infoq.system.domain.vo.SysOssUploadVo;
import cc.infoq.system.domain.vo.SysOssVo;
import cc.infoq.system.service.SysOssService;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.constraints.NotEmpty;
import lombok.AllArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;

/**
 * 文件上传 控制层
 *
 * @author Pontus
 */
@Validated
@AllArgsConstructor
@RestController
@RequestMapping("/resource/oss")
public class SysOssController extends BaseController {

    private final SysOssService sysOssService;

    /**
     * 查询OSS对象存储列表
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:oss:list')")
    @GetMapping("/list")
    public TableDataInfo<SysOssVo> list(@Validated(QueryGroup.class) SysOssBo bo, PageQuery pageQuery) {
        return sysOssService.queryPageList(bo, pageQuery);
    }

    /**
     * 查询OSS对象基于id串
     *
     * @param ossIds OSS对象ID串
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:oss:query')")
    @GetMapping("/listByIds/{ossIds}")
    public ApiResult<List<SysOssVo>> listByIds(@NotEmpty(message = "主键不能为空")
                                       @PathVariable Long[] ossIds) {
        List<SysOssVo> list = sysOssService.listByIds(Arrays.asList(ossIds));
        return ApiResult.ok(list);
    }

    /**
     * 上传OSS对象存储
     *
     * @param file 文件
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:oss:upload')")
    @Log(title = "OSS对象存储", businessType = BusinessType.INSERT)
    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResult<SysOssUploadVo> upload(@RequestPart("file") MultipartFile file) {
        SysOssVo oss = sysOssService.upload(file);
        SysOssUploadVo uploadVo = new SysOssUploadVo();
        uploadVo.setUrl(oss.getUrl());
        uploadVo.setFileName(oss.getOriginalName());
        uploadVo.setOssId(oss.getOssId().toString());
        return ApiResult.ok(uploadVo);
    }

    /**
     * 下载OSS对象
     *
     * @param ossId OSS对象ID
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:oss:download')")
    @GetMapping("/download/{ossId}")
    public void download(@PathVariable Long ossId, HttpServletResponse response) throws IOException {
        sysOssService.download(ossId, response);
    }

    /**
     * 删除OSS对象存储
     *
     * @param ossIds OSS对象ID串
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:oss:remove')")
    @Log(title = "OSS对象存储", businessType = BusinessType.DELETE)
    @DeleteMapping("/{ossIds}")
    public ApiResult<Void> remove(@NotEmpty(message = "主键不能为空")
                          @PathVariable Long[] ossIds) {
        return toAjax(sysOssService.deleteWithValidByIds(List.of(ossIds), true));
    }

}
