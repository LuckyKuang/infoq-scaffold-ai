package cc.infoq.system.runner;

import cc.infoq.system.service.SysOssConfigService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.ApplicationArguments;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
@Tag("dev")
class SystemApplicationRunnerTest {

    @Mock
    private SysOssConfigService ossConfigService;

    @Test
    @DisplayName("run: should initialize oss config")
    void runShouldInitializeOssConfig() throws Exception {
        SystemApplicationRunner runner = new SystemApplicationRunner(ossConfigService);

        runner.run(mock(ApplicationArguments.class));

        verify(ossConfigService).init();
    }
}
