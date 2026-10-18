package cc.infoq.system.controller.system;

import cc.infoq.common.domain.ApiResult;
import cc.infoq.common.excel.utils.ExcelUtil;
import cc.infoq.common.mybatis.core.page.PageQuery;
import cc.infoq.common.mybatis.core.page.TableDataInfo;
import cc.infoq.system.domain.bo.SysDictTypeBo;
import cc.infoq.system.domain.vo.SysDictTypeVo;
import cc.infoq.system.service.SysDictTypeService;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@Tag("dev")
class SysDictTypeControllerTest {

    @Mock
    private SysDictTypeService sysDictTypeService;

    @InjectMocks
    private SysDictTypeController controller;

    @Test
    @DisplayName("list: should return paged dict types")
    void listShouldReturnPagedDictTypes() {
        SysDictTypeBo bo = new SysDictTypeBo();
        PageQuery pageQuery = new PageQuery(1, 10);
        TableDataInfo<SysDictTypeVo> table = TableDataInfo.build(List.of(new SysDictTypeVo()));
        when(sysDictTypeService.selectPageDictTypeList(bo, pageQuery)).thenReturn(table);

        TableDataInfo<SysDictTypeVo> result = controller.list(bo, pageQuery);

        assertEquals(1L, result.getTotal());
    }

    @Test
    @DisplayName("getInfo: should return dict type detail")
    void getInfoShouldReturnDictTypeDetail() {
        SysDictTypeVo vo = new SysDictTypeVo();
        vo.setDictId(11L);
        when(sysDictTypeService.selectDictTypeById(11L)).thenReturn(vo);

        ApiResult<SysDictTypeVo> result = controller.getInfo(11L);

        assertEquals(ApiResult.SUCCESS, result.getCode());
        assertEquals(11L, result.getData().getDictId());
    }

    @Test
    @DisplayName("export: should query rows and invoke excel util")
    void exportShouldQueryRowsAndInvokeExcelUtil() {
        SysDictTypeBo bo = new SysDictTypeBo();
        List<SysDictTypeVo> rows = List.of(new SysDictTypeVo());
        HttpServletResponse response = org.mockito.Mockito.mock(HttpServletResponse.class);
        when(sysDictTypeService.selectDictTypeList(bo)).thenReturn(rows);

        try (MockedStatic<ExcelUtil> excelUtil = mockStatic(ExcelUtil.class)) {
            controller.export(bo, response);
            excelUtil.verify(() -> ExcelUtil.exportExcel(rows, "字典类型", SysDictTypeVo.class, response));
        }
    }

    @Test
    @DisplayName("add: should fail when dict type already exists")
    void addShouldFailWhenTypeExists() {
        SysDictTypeBo bo = new SysDictTypeBo();
        bo.setDictName("yes_no");
        when(sysDictTypeService.checkDictTypeUnique(bo)).thenReturn(false);

        ApiResult<Void> result = controller.add(bo);

        assertEquals(ApiResult.FAIL, result.getCode());
        assertTrue(result.getMsg().contains("字典类型已存在"));
    }

    @Test
    @DisplayName("edit: should fail when dict type already exists")
    void editShouldFailWhenTypeExists() {
        SysDictTypeBo bo = new SysDictTypeBo();
        bo.setDictName("yes_no");
        when(sysDictTypeService.checkDictTypeUnique(bo)).thenReturn(false);

        ApiResult<Void> result = controller.edit(bo);

        assertEquals(ApiResult.FAIL, result.getCode());
        assertTrue(result.getMsg().contains("字典类型已存在"));
    }

    @Test
    @DisplayName("edit: should return success when dict type unique")
    void editShouldReturnSuccessWhenTypeUnique() {
        SysDictTypeBo bo = new SysDictTypeBo();
        bo.setDictName("yes_no");
        when(sysDictTypeService.checkDictTypeUnique(bo)).thenReturn(true);

        ApiResult<Void> result = controller.edit(bo);

        assertEquals(ApiResult.SUCCESS, result.getCode());
        verify(sysDictTypeService).updateDictType(bo);
    }

    @Test
    @DisplayName("remove: should delegate delete and return success")
    void removeShouldDelegateDeleteAndReturnSuccess() {
        ApiResult<Void> result = controller.remove(new Long[]{2L, 3L});

        assertEquals(ApiResult.SUCCESS, result.getCode());
        verify(sysDictTypeService).deleteDictTypeByIds(List.of(2L, 3L));
    }

    @Test
    @DisplayName("refreshCache: should invoke service and return success")
    void refreshCacheShouldInvokeServiceAndReturnSuccess() {
        ApiResult<Void> result = controller.refreshCache();

        assertEquals(ApiResult.SUCCESS, result.getCode());
        verify(sysDictTypeService).resetDictCache();
    }

    @Test
    @DisplayName("optionselect: should return all dict types")
    void optionselectShouldReturnAllDictTypes() {
        SysDictTypeVo vo = new SysDictTypeVo();
        vo.setDictId(99L);
        when(sysDictTypeService.selectDictTypeAll()).thenReturn(List.of(vo));

        ApiResult<List<SysDictTypeVo>> result = controller.optionselect();

        assertEquals(ApiResult.SUCCESS, result.getCode());
        assertEquals(1, result.getData().size());
        assertEquals(99L, result.getData().get(0).getDictId());
    }
}
