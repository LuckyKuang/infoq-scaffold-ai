package cc.infoq.system.service.impl;

import cc.infoq.common.quartz.core.ManagedQuartzTaskHandler;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * 调度演示任务处理器
 *
 * @author Pontus
 */
@Slf4j
@Component
@ConditionalOnProperty(prefix = "infoq.quartz", name = "enabled", havingValue = "true", matchIfMissing = true)
public class SchedulerNoopTaskHandler implements ManagedQuartzTaskHandler {

    public static final String HANDLER_KEY = "system.noop";

    @Override
    public String handlerKey() {
        return HANDLER_KEY;
    }

    @Override
    public void execute(Map<String, Object> params) {
        log.info("执行调度演示任务, params={}", params);
    }
}
