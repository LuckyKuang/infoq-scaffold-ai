package cc.infoq.common.quartz.core;

import cc.infoq.common.exception.ServiceException;
import cc.infoq.common.utils.SpringUtils;
import org.quartz.Job;
import org.quartz.JobDataMap;
import org.quartz.JobExecutionContext;
import org.quartz.JobExecutionException;

/**
 * Quartz 任务桥接 Job
 *
 * @author Pontus
 */
public class ManagedQuartzJob implements Job {

    public static final String PAYLOAD_KEY = "payload";

    @Override
    public void execute(JobExecutionContext context) throws JobExecutionException {
        JobDataMap jobDataMap = context.getMergedJobDataMap();
        ManagedQuartzTaskPayload payload = (ManagedQuartzTaskPayload) jobDataMap.get(PAYLOAD_KEY);
        if (payload == null || payload.getJobId() == null) {
            throw new JobExecutionException(new ServiceException("Quartz 任务缺少运行负载"));
        }
        try {
            SpringUtils.getBean(ManagedQuartzJobExecutor.class).execute(payload);
        } catch (Exception e) {
            throw new JobExecutionException(e);
        }
    }
}
