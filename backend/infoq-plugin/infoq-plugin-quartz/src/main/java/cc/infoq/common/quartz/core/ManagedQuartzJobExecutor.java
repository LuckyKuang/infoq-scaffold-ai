package cc.infoq.common.quartz.core;

import cc.infoq.common.exception.ServiceException;

/**
 * Quartz Job 执行桥接器
 *
 * @author Pontus
 */
public interface ManagedQuartzJobExecutor {

    /**
     * 执行任务并将运行明细写入日志
     *
     * @param payload Quartz 运行负载
     * @throws ServiceException 业务失败
     */
    void execute(ManagedQuartzTaskPayload payload);
}
