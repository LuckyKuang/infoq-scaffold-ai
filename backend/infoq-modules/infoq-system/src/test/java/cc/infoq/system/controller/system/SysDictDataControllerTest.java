package cc.infoq.system.controller.system;

import cc.infoq.common.domain.ApiResult;
import cc.infoq.common.excel.utils.ExcelUtil;
import cc.infoq.common.mybatis.core.page.PageQuery;
import cc.infoq.common.mybatis.core.page.TableDataInfo;
import cc.infoq.system.domain.bo.SysDictDataBo;
import cc.infoq.system.domain.vo.SysDictDataVo;
import cc.infoq.system.service.SysDictDataService;
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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@Tag("dev")
class SysDictDataControllerTest {

    @Mock
    private SysDictDataService sysDictDataService;
    @Mock
    private SysDictTypeService sysDictTypeService;

    @InjectMocks
    private SysDictDataController controller;

    @Test
    @DisplayName("list: should return paged dict data from service")
    void listShouldReturnPagedDictDataFromService() {
        SysDictDataBo bo = new SysDictDataBo();
        PageQuery pageQuery = new PageQuery(1, 10);
        TableDataInfo<SysDictDataVo> table = TableDataInfo.build(List.of(new SysDictDataVo()));
        when(sysDictDataService.selectPageDictDataList(bo, pageQuery)).thenReturn(table);

        TableDataInfo<SysDictDataVo> result = controller.list(bo, pageQuery);

        assertEquals(1L, result.getTotal());
    }

    @Test
    @DisplayName("getInfo: should return dict data detail")
    void getInfoShouldReturnDictDataDetail() {
        SysDictDataVo vo = new SysDictDataVo();
        vo.setDictCode(9L);
        when(sysDictDataService.selectDictDataById(9L)).thenReturn(vo);

        ApiResult<SysDictDataVo> result = controller.getInfo(9L);

        assertEquals(ApiResult.SUCCESS, result.getCode());
        assertEquals(9L, result.getData().getDictCode());
    }

    @Test
    @DisplayName("export: should query rows and invoke excel util")
    void exportShouldQueryRowsAndInvokeExcelUtil() {
        SysDictDataBo bo = new SysDictDataBo();
        List<SysDictDataVo> rows = List.of(new SysDictDataVo());
        HttpServletResponse response = org.mockito.Mockito.mock(HttpServletResponse.class);
        when(sysDictDataService.selectDictDataList(bo)).thenReturn(rows);

        try (MockedStatic<ExcelUtil> excelUtil = mockStatic(ExcelUtil.class)) {
            controller.export(bo, response);
            excelUtil.verify(() -> ExcelUtil.exportExcel(rows, "字典数据", SysDictDataVo.class, response));
        }
    }

    @Test
    @DisplayName("dictType: should return list when data exists")
    void dictTypeShouldReturnListWhenDataExists() {
        SysDictDataVo vo = new SysDictDataVo();
        vo.setDictValue("1");
        when(sysDictTypeService.selectDictDataByType("sys_status")).thenReturn(List.of(vo));

        ApiResult<List<SysDictDataVo>> result = controller.dictType("sys_status");

        assertEquals(ApiResult.SUCCESS, result.getCode());
        assertEquals(1, result.getData().size());
    }

    @Test
    @DisplayName("dictType: should fallback to empty list when service returns null")
    void dictTypeShouldFallbackToEmptyList() {
        when(sysDictTypeService.selectDictDataByType("sys_x")).thenReturn(null);

        ApiResult<List<SysDictDataVo>> result = controller.dictType("sys_x");

        assertEquals(ApiResult.SUCCESS, result.getCode());
        assertNotNull(result.getData());
        assertEquals(0, result.getData().size());
    }

    @Test
    @DisplayName("add: should fail when dict value duplicated")
    void addShouldFailWhenDictValueDuplicated() {
        SysDictDataBo bo = new SysDictDataBo();
        bo.setDictValue("1");
        when(sysDictDataService.checkDictDataUnique(bo)).thenReturn(false);

        ApiResult<Void> result = controller.add(bo);

        assertEquals(ApiResult.FAIL, result.getCode());
        assertTrue(result.getMsg().contains("字典键值已存在"));
    }

    @Test
    @DisplayName("add: should return success when dict value unique")
    void addShouldReturnSuccessWhenDictValueUnique() {
        SysDictDataBo bo = new SysDictDataBo();
        bo.setDictValue("1");
        when(sysDictDataService.checkDictDataUnique(bo)).thenReturn(true);

        ApiResult<Void> result = controller.add(bo);

        assertEquals(ApiResult.SUCCESS, result.getCode());
        verify(sysDictDataService).insertDictData(bo);
    }

    @Test
    @DisplayName("edit: should fail when dict value duplicated")
    void editShouldFailWhenDictValueDuplicated() {
        SysDictDataBo bo = new SysDictDataBo();
        bo.setDictValue("1");
        when(sysDictDataService.checkDictDataUnique(bo)).thenReturn(false);

        ApiResult<Void> result = controller.edit(bo);

        assertEquals(ApiResult.FAIL, result.getCode());
        assertTrue(result.getMsg().contains("字典键值已存在"));
    }

    @Test
    @DisplayName("edit: should return success when dict value unique")
    void editShouldReturnSuccessWhenDictValueUnique() {
        SysDictDataBo bo = new SysDictDataBo();
        bo.setDictValue("2");
        when(sysDictDataService.checkDictDataUnique(bo)).thenReturn(true);

        ApiResult<Void> result = controller.edit(bo);

        assertEquals(ApiResult.SUCCESS, result.getCode());
        verify(sysDictDataService).updateDictData(bo);
    }

    @Test
    @DisplayName("remove: should delegate delete and return success")
    void removeShouldDelegateDeleteAndReturnSuccess() {
        ApiResult<Void> result = controller.remove(new Long[]{1L, 2L});

        assertEquals(ApiResult.SUCCESS, result.getCode());
        verify(sysDictDataService).deleteDictDataByIds(List.of(1L, 2L));
    }
}
