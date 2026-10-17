package cc.infoq.system.controller.system;

import cc.infoq.common.domain.ApiResult;
import cc.infoq.common.excel.utils.ExcelUtil;
import cc.infoq.common.log.annotation.Log;
import cc.infoq.common.log.enums.BusinessType;
import cc.infoq.common.mybatis.core.page.PageQuery;
import cc.infoq.common.mybatis.core.page.TableDataInfo;
import cc.infoq.common.redis.annotation.RepeatSubmit;
import cc.infoq.common.web.core.BaseController;
import cc.infoq.system.domain.bo.SysDictTypeBo;
import cc.infoq.system.domain.vo.SysDictTypeVo;
import cc.infoq.system.service.SysDictTypeService;
import com.baomidou.lock.annotation.Lock4j;
import jakarta.servlet.http.HttpServletResponse;
import lombok.AllArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.List;

/**
 * 数据字典信息
 *
 * @author Pontus
 */
@Validated
@AllArgsConstructor
@RestController
@RequestMapping("/system/dict/type")
public class SysDictTypeController extends BaseController {

    private final SysDictTypeService sysDictTypeService;

    /**
     * 查询字典类型列表
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:dict:list')")
    @GetMapping("/list")
    public TableDataInfo<SysDictTypeVo> list(SysDictTypeBo dictType, PageQuery pageQuery) {
        return sysDictTypeService.selectPageDictTypeList(dictType, pageQuery);
    }

    /**
     * 导出字典类型列表
     */
    @Log(title = "字典类型", businessType = BusinessType.EXPORT)
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:dict:export')")
    @PostMapping("/export")
    public void export(SysDictTypeBo dictType, HttpServletResponse response) {
        List<SysDictTypeVo> list = sysDictTypeService.selectDictTypeList(dictType);
        ExcelUtil.exportExcel(list, "字典类型", SysDictTypeVo.class, response);
    }

    /**
     * 查询字典类型详细
     *
     * @param dictId 字典ID
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:dict:query')")
    @GetMapping(value = "/{dictId}")
    public ApiResult<SysDictTypeVo> getInfo(@PathVariable Long dictId) {
        return ApiResult.ok(sysDictTypeService.selectDictTypeById(dictId));
    }

    /**
     * 新增字典类型
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:dict:add')")
    @Log(title = "字典类型", businessType = BusinessType.INSERT)
    @RepeatSubmit()
    @PostMapping
    public ApiResult<Void> add(@Validated @RequestBody SysDictTypeBo dict) {
        if (!sysDictTypeService.checkDictTypeUnique(dict)) {
            return ApiResult.fail("新增字典'" + dict.getDictName() + "'失败，字典类型已存在");
        }
        sysDictTypeService.insertDictType(dict);
        return ApiResult.ok();
    }

    /**
     * 修改字典类型
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:dict:edit')")
    @Log(title = "字典类型", businessType = BusinessType.UPDATE)
    @RepeatSubmit()
    @PutMapping
    public ApiResult<Void> edit(@Validated @RequestBody SysDictTypeBo dict) {
        if (!sysDictTypeService.checkDictTypeUnique(dict)) {
            return ApiResult.fail("修改字典'" + dict.getDictName() + "'失败，字典类型已存在");
        }
        sysDictTypeService.updateDictType(dict);
        return ApiResult.ok();
    }

    /**
     * 删除字典类型
     *
     * @param dictIds 字典ID串
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:dict:remove')")
    @Log(title = "字典类型", businessType = BusinessType.DELETE)
    @DeleteMapping("/{dictIds}")
    public ApiResult<Void> remove(@PathVariable Long[] dictIds) {
        sysDictTypeService.deleteDictTypeByIds(Arrays.asList(dictIds));
        return ApiResult.ok();
    }

    /**
     * 刷新字典缓存
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:dict:remove')")
    @Log(title = "字典类型", businessType = BusinessType.CLEAN)
    @Lock4j
    @DeleteMapping("/refreshCache")
    public ApiResult<Void> refreshCache() {
        sysDictTypeService.resetDictCache();
        return ApiResult.ok();
    }

    /**
     * 获取字典选择框列表
     */
    @GetMapping("/optionselect")
    public ApiResult<List<SysDictTypeVo>> optionselect() {
        List<SysDictTypeVo> dictTypes = sysDictTypeService.selectDictTypeAll();
        return ApiResult.ok(dictTypes);
    }
}
