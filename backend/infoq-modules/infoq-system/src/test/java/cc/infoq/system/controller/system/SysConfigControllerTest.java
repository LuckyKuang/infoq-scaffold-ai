package cc.infoq.system.controller.system;

import cc.infoq.common.domain.ApiResult;
import cc.infoq.common.excel.utils.ExcelUtil;
import cc.infoq.common.mybatis.core.page.PageQuery;
import cc.infoq.common.mybatis.core.page.TableDataInfo;
import cc.infoq.system.domain.bo.SysConfigBo;
import cc.infoq.system.domain.vo.SysConfigVo;
import cc.infoq.system.service.SysConfigService;
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
class SysConfigControllerTest {

    @Mock
    private SysConfigService sysConfigService;

    @InjectMocks
    private SysConfigController controller;

    @Test
    @DisplayName("list: should return paged config list")
    void listShouldReturnPagedConfigList() {
        SysConfigBo bo = new SysConfigBo();
        PageQuery pageQuery = new PageQuery(1, 10);
        TableDataInfo<SysConfigVo> table = TableDataInfo.build(List.of(new SysConfigVo()));
        when(sysConfigService.selectPageConfigList(bo, pageQuery)).thenReturn(table);

        TableDataInfo<SysConfigVo> result = controller.list(bo, pageQuery);

        assertEquals(1L, result.getTotal());
    }

    @Test
    @DisplayName("getInfo: should return config detail")
    void getInfoShouldReturnConfigDetail() {
        SysConfigVo config = new SysConfigVo();
        config.setConfigId(8L);
        when(sysConfigService.selectConfigById(8L)).thenReturn(config);

        ApiResult<SysConfigVo> result = controller.getInfo(8L);

        assertEquals(ApiResult.SUCCESS, result.getCode());
        assertEquals(8L, result.getData().getConfigId());
    }

    @Test
    @DisplayName("getConfigKey: should return config value by key")
    void getConfigKeyShouldReturnConfigValue() {
        when(sysConfigService.selectConfigByKey("sys.demo")).thenReturn("demo-value");

        ApiResult<String> result = controller.getConfigKey("sys.demo");

        assertEquals(ApiResult.SUCCESS, result.getCode());
        assertEquals("demo-value", result.getData());
    }

    @Test
    @DisplayName("export: should query rows and invoke excel util")
    void exportShouldQueryRowsAndInvokeExcelUtil() {
        SysConfigBo bo = new SysConfigBo();
        List<SysConfigVo> rows = List.of(new SysConfigVo());
        HttpServletResponse response = org.mockito.Mockito.mock(HttpServletResponse.class);
        when(sysConfigService.selectConfigList(bo)).thenReturn(rows);

        try (MockedStatic<ExcelUtil> excelUtil = mockStatic(ExcelUtil.class)) {
            controller.export(bo, response);
            excelUtil.verify(() -> ExcelUtil.exportExcel(rows, "参数数据", SysConfigVo.class, response));
        }
    }

    @Test
    @DisplayName("add: should fail when config key already exists")
    void addShouldFailWhenKeyExists() {
        SysConfigBo bo = new SysConfigBo();
        bo.setConfigName("name");
        when(sysConfigService.checkConfigKeyUnique(bo)).thenReturn(false);

        ApiResult<Void> result = controller.add(bo);

        assertEquals(ApiResult.FAIL, result.getCode());
        assertTrue(result.getMsg().contains("参数键名已存在"));
    }

    @Test
    @DisplayName("edit: should fail when config key already exists")
    void editShouldFailWhenKeyExists() {
        SysConfigBo bo = new SysConfigBo();
        bo.setConfigName("name");
        when(sysConfigService.checkConfigKeyUnique(bo)).thenReturn(false);

        ApiResult<Void> result = controller.edit(bo);

        assertEquals(ApiResult.FAIL, result.getCode());
        assertTrue(result.getMsg().contains("参数键名已存在"));
    }

    @Test
    @DisplayName("edit: should return success when config key unique")
    void editShouldReturnSuccessWhenKeyUnique() {
        SysConfigBo bo = new SysConfigBo();
        bo.setConfigName("name");
        when(sysConfigService.checkConfigKeyUnique(bo)).thenReturn(true);

        ApiResult<Void> result = controller.edit(bo);

        assertEquals(ApiResult.SUCCESS, result.getCode());
        verify(sysConfigService).updateConfig(bo);
    }

    @Test
    @DisplayName("updateByKey: should delegate update and return success")
    void updateByKeyShouldDelegateUpdateAndReturnSuccess() {
        SysConfigBo bo = new SysConfigBo();
        bo.setConfigKey("sys.demo");

        ApiResult<Void> result = controller.updateByKey(bo);

        assertEquals(ApiResult.SUCCESS, result.getCode());
        verify(sysConfigService).updateConfig(bo);
    }

    @Test
    @DisplayName("remove: should delegate delete and return success")
    void removeShouldDelegateDeleteAndReturnSuccess() {
        ApiResult<Void> result = controller.remove(new Long[]{1L, 2L});

        assertEquals(ApiResult.SUCCESS, result.getCode());
        verify(sysConfigService).deleteConfigByIds(List.of(1L, 2L));
    }

    @Test
    @DisplayName("refreshCache: should invoke service and return success")
    void refreshCacheShouldInvokeService() {
        ApiResult<Void> result = controller.refreshCache();

        assertEquals(ApiResult.SUCCESS, result.getCode());
        verify(sysConfigService).resetConfigCache();
    }
}
