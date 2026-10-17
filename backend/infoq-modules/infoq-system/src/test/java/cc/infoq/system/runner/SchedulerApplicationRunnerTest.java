package cc.infoq.system.runner;

import cc.infoq.system.service.SysJobService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.ApplicationArguments;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
@Tag("dev")
class SchedulerApplicationRunnerTest {

    @Mock
    private SysJobService sysJobService;
    @Mock
    private QuartzBootstrapCoordinator quartzBootstrapCoordinator;

    @Test
    @DisplayName("run: should delegate bootstrap reconcile to coordinator")
    void runShouldDelegateBootstrapReconcileToCoordinator() throws Exception {
        SchedulerApplicationRunner runner = new SchedulerApplicationRunner(sysJobService, quartzBootstrapCoordinator);

        runner.run(mock(ApplicationArguments.class));

        ArgumentCaptor<Runnable> captor = ArgumentCaptor.forClass(Runnable.class);
        verify(quartzBootstrapCoordinator).reconcile(captor.capture());
        captor.getValue().run();
        verify(sysJobService).init();
        verifyNoMoreInteractions(sysJobService);
    }

    @Test
    @DisplayName("getOrder: should run after earlier infrastructure runners")
    void getOrderShouldReturnStableOrder() {
        SchedulerApplicationRunner runner = new SchedulerApplicationRunner(sysJobService, quartzBootstrapCoordinator);

        assertEquals(10, runner.getOrder());
    }
}
