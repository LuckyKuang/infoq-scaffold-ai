package cc.infoq.system.runner;

import cc.infoq.system.service.SysJobService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.Ordered;
import org.springframework.stereotype.Component;

/**
 * 调度任务恢复 Runner
 *
 * @author Pontus
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "infoq.quartz", name = "enabled", havingValue = "true", matchIfMissing = true)
public class SchedulerApplicationRunner implements ApplicationRunner, Ordered {

    private final SysJobService sysJobService;
    private final QuartzBootstrapCoordinator quartzBootstrapCoordinator;

    @Override
    public void run(ApplicationArguments args) {
        boolean executed = quartzBootstrapCoordinator.reconcile(sysJobService::init);
        if (executed) {
            log.info("托管定时任务初始化已执行");
            return;
        }
        log.info("托管定时任务初始化已跳过");
    }

    @Override
    public int getOrder() {
        return 10;
    }
}
