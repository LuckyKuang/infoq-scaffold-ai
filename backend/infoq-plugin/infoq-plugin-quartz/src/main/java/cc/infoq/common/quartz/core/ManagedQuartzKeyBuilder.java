package cc.infoq.common.quartz.core;

import cc.infoq.common.quartz.properties.QuartzManagedProperties;
import lombok.RequiredArgsConstructor;
import org.quartz.JobKey;
import org.quartz.TriggerKey;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Quartz key 构造器
 *
 * @author Pontus
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "infoq.quartz", name = "enabled", havingValue = "true", matchIfMissing = true)
public class ManagedQuartzKeyBuilder {

    private final QuartzManagedProperties properties;

    public JobKey jobKey(Long jobId, String jobGroup) {
        return JobKey.jobKey(jobName(jobId), managedGroup(jobGroup));
    }

    public TriggerKey triggerKey(Long jobId, String jobGroup) {
        return TriggerKey.triggerKey(triggerName(jobId), managedGroup(jobGroup));
    }

    public String managedGroup(String jobGroup) {
        return properties.getManagedGroupPrefix() + jobGroup;
    }

    public boolean isManagedGroup(String quartzGroup) {
        return quartzGroup != null && quartzGroup.startsWith(properties.getManagedGroupPrefix());
    }

    private String jobName(Long jobId) {
        return "TASK_" + jobId;
    }

    private String triggerName(Long jobId) {
        return "TRIGGER_" + jobId;
    }
}
