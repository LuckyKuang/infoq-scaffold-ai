package cc.infoq.system.controller.system;

import cc.infoq.common.domain.ApiResult;
import cc.infoq.common.excel.utils.ExcelUtil;
import cc.infoq.common.mybatis.core.page.PageQuery;
import cc.infoq.common.mybatis.core.page.TableDataInfo;
import cc.infoq.system.domain.bo.SysClientBo;
import cc.infoq.system.domain.vo.SysClientVo;
import cc.infoq.system.service.SysClientService;
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
class SysClientControllerTest {

    @Mock
    private SysClientService sysClientService;

    @InjectMocks
    private SysClientController controller;

    @Test
    @DisplayName("list: should return table data from service")
    void listShouldReturnDataFromService() {
        SysClientBo bo = new SysClientBo();
        PageQuery pageQuery = new PageQuery(10, 1);
        TableDataInfo<SysClientVo> table = TableDataInfo.build(List.of(new SysClientVo()));
        when(sysClientService.queryPageList(bo, pageQuery)).thenReturn(table);

        TableDataInfo<SysClientVo> result = controller.list(bo, pageQuery);

        assertEquals(1L, result.getTotal());
    }

    @Test
    @DisplayName("getInfo: should return client detail from service")
    void getInfoShouldReturnClientDetailFromService() {
        SysClientVo client = new SysClientVo();
        client.setId(100L);
        when(sysClientService.queryById(100L)).thenReturn(client);

        ApiResult<SysClientVo> result = controller.getInfo(100L);

        assertEquals(ApiResult.SUCCESS, result.getCode());
        assertEquals(100L, result.getData().getId());
    }

    @Test
    @DisplayName("export: should query rows and invoke excel util")
    void exportShouldQueryRowsAndInvokeExcelUtil() {
        SysClientBo bo = new SysClientBo();
        List<SysClientVo> rows = List.of(new SysClientVo());
        HttpServletResponse response = org.mockito.Mockito.mock(HttpServletResponse.class);
        when(sysClientService.queryList(bo)).thenReturn(rows);

        try (MockedStatic<ExcelUtil> excelUtil = mockStatic(ExcelUtil.class)) {
            controller.export(bo, response);
            excelUtil.verify(() -> ExcelUtil.exportExcel(rows, "客户端管理", SysClientVo.class, response));
        }
    }

    @Test
    @DisplayName("add: should fail when client key already exists")
    void addShouldFailWhenClientKeyExists() {
        SysClientBo bo = new SysClientBo();
        bo.setClientKey("web");
        when(sysClientService.checkClickKeyUnique(bo)).thenReturn(false);

        ApiResult<Void> result = controller.add(bo);

        assertEquals(ApiResult.FAIL, result.getCode());
        assertTrue(result.getMsg().contains("客户端key已存在"));
    }

    @Test
    @DisplayName("add: should return ok when key is unique and insert succeeded")
    void addShouldReturnOkWhenInsertSuccess() {
        SysClientBo bo = new SysClientBo();
        bo.setClientKey("web");
        when(sysClientService.checkClickKeyUnique(bo)).thenReturn(true);
        when(sysClientService.insertByBo(bo)).thenReturn(true);

        ApiResult<Void> result = controller.add(bo);

        assertEquals(ApiResult.SUCCESS, result.getCode());
    }

    @Test
    @DisplayName("edit: should fail when client key is duplicated")
    void editShouldFailWhenClientKeyDuplicated() {
        SysClientBo bo = new SysClientBo();
        bo.setClientKey("mobile");
        when(sysClientService.checkClickKeyUnique(bo)).thenReturn(false);

        ApiResult<Void> result = controller.edit(bo);

        assertEquals(ApiResult.FAIL, result.getCode());
        assertTrue(result.getMsg().contains("客户端key已存在"));
    }

    @Test
    @DisplayName("edit: should return success when update succeeded")
    void editShouldReturnSuccessWhenUpdateSucceeded() {
        SysClientBo bo = new SysClientBo();
        bo.setClientKey("mobile");
        when(sysClientService.checkClickKeyUnique(bo)).thenReturn(true);
        when(sysClientService.updateByBo(bo)).thenReturn(true);

        ApiResult<Void> result = controller.edit(bo);

        assertEquals(ApiResult.SUCCESS, result.getCode());
    }

    @Test
    @DisplayName("changeStatus: should map service rows to success response")
    void changeStatusShouldMapRowsToApiResult() {
        SysClientBo bo = new SysClientBo();
        bo.setClientId("cid");
        bo.setStatus("0");
        when(sysClientService.updateClientStatus("cid", "0")).thenReturn(1);

        ApiResult<Void> result = controller.changeStatus(bo);

        assertEquals(ApiResult.SUCCESS, result.getCode());
    }

    @Test
    @DisplayName("remove: should map delete result to success response")
    void removeShouldMapDeleteResultToSuccessResponse() {
        when(sysClientService.deleteWithValidByIds(List.of(3L, 4L), true)).thenReturn(true);

        ApiResult<Void> result = controller.remove(new Long[]{3L, 4L});

        assertEquals(ApiResult.SUCCESS, result.getCode());
        verify(sysClientService).deleteWithValidByIds(List.of(3L, 4L), true);
    }
}
