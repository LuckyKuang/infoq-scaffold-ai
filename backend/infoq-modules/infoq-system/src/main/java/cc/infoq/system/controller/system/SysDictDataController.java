package cc.infoq.system.controller.system;

import cc.infoq.common.domain.ApiResult;
import cc.infoq.common.excel.utils.ExcelUtil;
import cc.infoq.common.log.annotation.Log;
import cc.infoq.common.log.enums.BusinessType;
import cc.infoq.common.mybatis.core.page.PageQuery;
import cc.infoq.common.mybatis.core.page.TableDataInfo;
import cc.infoq.common.redis.annotation.RepeatSubmit;
import cc.infoq.common.web.core.BaseController;
import cc.infoq.system.domain.bo.SysDictDataBo;
import cc.infoq.system.domain.vo.SysDictDataVo;
import cc.infoq.system.service.SysDictDataService;
import cc.infoq.system.service.SysDictTypeService;
import cn.hutool.core.util.ObjectUtil;
import jakarta.servlet.http.HttpServletResponse;
import lombok.AllArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
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
@RequestMapping("/system/dict/data")
public class SysDictDataController extends BaseController {

    private final SysDictDataService sysDictDataService;
    private final SysDictTypeService sysDictTypeService;

    /**
     * 查询字典数据列表
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:dict:list')")
    @GetMapping("/list")
    public TableDataInfo<SysDictDataVo> list(SysDictDataBo dictData, PageQuery pageQuery) {
        return sysDictDataService.selectPageDictDataList(dictData, pageQuery);
    }

    /**
     * 导出字典数据列表
     */
    @Log(title = "字典数据", businessType = BusinessType.EXPORT)
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:dict:export')")
    @PostMapping("/export")
    public void export(SysDictDataBo dictData, HttpServletResponse response) {
        List<SysDictDataVo> list = sysDictDataService.selectDictDataList(dictData);
        ExcelUtil.exportExcel(list, "字典数据", SysDictDataVo.class, response);
    }

    /**
     * 查询字典数据详细
     *
     * @param dictCode 字典code
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:dict:query')")
    @GetMapping(value = "/{dictCode}")
    public ApiResult<SysDictDataVo> getInfo(@PathVariable Long dictCode) {
        return ApiResult.ok(sysDictDataService.selectDictDataById(dictCode));
    }

    /**
     * 根据字典类型查询字典数据信息
     *
     * @param dictType 字典类型
     */
    @GetMapping(value = "/type/{dictType}")
    public ApiResult<List<SysDictDataVo>> dictType(@PathVariable String dictType) {
        List<SysDictDataVo> data = sysDictTypeService.selectDictDataByType(dictType);
        if (ObjectUtil.isNull(data)) {
            data = new ArrayList<>();
        }
        return ApiResult.ok(data);
    }

    /**
     * 新增字典类型
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:dict:add')")
    @Log(title = "字典数据", businessType = BusinessType.INSERT)
    @RepeatSubmit()
    @PostMapping
    public ApiResult<Void> add(@Validated @RequestBody SysDictDataBo dict) {
        if (!sysDictDataService.checkDictDataUnique(dict)) {
            return ApiResult.fail("新增字典数据'" + dict.getDictValue() + "'失败，字典键值已存在");
        }
        sysDictDataService.insertDictData(dict);
        return ApiResult.ok();
    }

    /**
     * 修改保存字典类型
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:dict:edit')")
    @Log(title = "字典数据", businessType = BusinessType.UPDATE)
    @RepeatSubmit()
    @PutMapping
    public ApiResult<Void> edit(@Validated @RequestBody SysDictDataBo dict) {
        if (!sysDictDataService.checkDictDataUnique(dict)) {
            return ApiResult.fail("修改字典数据'" + dict.getDictValue() + "'失败，字典键值已存在");
        }
        sysDictDataService.updateDictData(dict);
        return ApiResult.ok();
    }

    /**
     * 删除字典类型
     *
     * @param dictCodes 字典code串
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:dict:remove')")
    @Log(title = "字典类型", businessType = BusinessType.DELETE)
    @DeleteMapping("/{dictCodes}")
    public ApiResult<Void> remove(@PathVariable Long[] dictCodes) {
        sysDictDataService.deleteDictDataByIds(Arrays.asList(dictCodes));
        return ApiResult.ok();
    }
}
