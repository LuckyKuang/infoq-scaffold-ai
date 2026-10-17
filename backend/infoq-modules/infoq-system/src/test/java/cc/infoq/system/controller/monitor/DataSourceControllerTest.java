package cc.infoq.system.controller.monitor;

import cc.infoq.common.domain.ApiResult;
import cc.infoq.system.domain.vo.DataSourceMonitorVo;
import cc.infoq.system.service.DataSourceMonitorService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@Tag("dev")
class DataSourceControllerTest {

    @Mock
    private DataSourceMonitorService dataSourceMonitorService;

    @InjectMocks
    private DataSourceController controller;

    @Test
    @DisplayName("getInfo: should return monitor data from service")
    void getInfoShouldReturnMonitorDataFromService() {
        DataSourceMonitorVo monitorVo = new DataSourceMonitorVo();
        DataSourceMonitorVo.Summary summary = new DataSourceMonitorVo.Summary();
        summary.setDataSourceCount(1);
        monitorVo.setSummary(summary);
        DataSourceMonitorVo.Pool pool = new DataSourceMonitorVo.Pool();
        pool.setName("master");
        monitorVo.setItems(List.of(pool));
        when(dataSourceMonitorService.getMonitorInfo()).thenReturn(monitorVo);

        ApiResult<DataSourceMonitorVo> result = controller.getInfo();

        assertEquals(ApiResult.SUCCESS, result.getCode());
        assertEquals(1, result.getData().getSummary().getDataSourceCount());
        assertEquals("master", result.getData().getItems().get(0).getName());
    }
}
