package cc.infoq.system.controller.monitor;

import cc.infoq.common.domain.ApiResult;
import cc.infoq.common.excel.utils.ExcelUtil;
import cc.infoq.common.mybatis.core.page.PageQuery;
import cc.infoq.common.mybatis.core.page.TableDataInfo;
import cc.infoq.system.domain.bo.SysOperLogBo;
import cc.infoq.system.domain.vo.SysOperLogVo;
import cc.infoq.system.service.SysOperLogService;
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
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@Tag("dev")
class SysOperLogControllerTest {

    @Mock
    private SysOperLogService operLogService;

    @InjectMocks
    private SysOperLogController controller;

    @Test
    @DisplayName("list: should return paged operation logs")
    void listShouldReturnPagedOperationLogs() {
        SysOperLogBo bo = new SysOperLogBo();
        PageQuery pageQuery = new PageQuery(1, 10);
        TableDataInfo<SysOperLogVo> table = TableDataInfo.build(List.of(new SysOperLogVo()));
        when(operLogService.selectPageOperLogList(bo, pageQuery)).thenReturn(table);

        TableDataInfo<SysOperLogVo> result = controller.list(bo, pageQuery);

        assertEquals(1L, result.getTotal());
    }

    @Test
    @DisplayName("remove: should map deleted rows to success")
    void removeShouldMapDeletedRowsToSuccess() {
        when(operLogService.deleteOperLogByIds(org.mockito.ArgumentMatchers.any(Long[].class))).thenReturn(2);

        ApiResult<Void> result = controller.remove(new Long[]{1L, 2L});

        assertEquals(ApiResult.SUCCESS, result.getCode());
    }

    @Test
    @DisplayName("export: should query rows and invoke excel util")
    void exportShouldQueryRowsAndInvokeExcelUtil() {
        SysOperLogBo bo = new SysOperLogBo();
        List<SysOperLogVo> rows = List.of(new SysOperLogVo());
        HttpServletResponse response = org.mockito.Mockito.mock(HttpServletResponse.class);
        when(operLogService.selectOperLogList(bo)).thenReturn(rows);

        try (MockedStatic<ExcelUtil> excelUtil = mockStatic(ExcelUtil.class)) {
            controller.export(bo, response);
            excelUtil.verify(() -> ExcelUtil.exportExcel(rows, "操作日志", SysOperLogVo.class, response));
        }
    }

    @Test
    @DisplayName("clean: should call service and return success")
    void cleanShouldCallService() {
        ApiResult<Void> result = controller.clean();

        assertEquals(ApiResult.SUCCESS, result.getCode());
        verify(operLogService).cleanOperLog();
    }
}
