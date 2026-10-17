package cc.infoq.system.controller.monitor;

import cc.infoq.common.domain.ApiResult;
import cc.infoq.system.domain.vo.ServerMonitorVo;
import cc.infoq.system.service.ServerMonitorService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@Tag("dev")
class ServerControllerTest {

    @Mock
    private ServerMonitorService serverMonitorService;

    @InjectMocks
    private ServerController controller;

    @Test
    @DisplayName("getInfo: should return service monitor result")
    void getInfoShouldReturnServiceMonitorResult() {
        ServerMonitorVo vo = new ServerMonitorVo();
        ServerMonitorVo.Cpu cpu = new ServerMonitorVo.Cpu();
        cpu.setCpuNum(8);
        vo.setCpu(cpu);
        when(serverMonitorService.getMonitorInfo()).thenReturn(vo);

        ApiResult<ServerMonitorVo> result = controller.getInfo();

        assertEquals(ApiResult.SUCCESS, result.getCode());
        assertEquals(8, result.getData().getCpu().getCpuNum());
    }
}
