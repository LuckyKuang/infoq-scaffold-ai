package cc.infoq.common.quartz.core;

import java.util.Map;

/**
 * 托管 Quartz 任务处理器
 *
 * @author Pontus
 */
public interface ManagedQuartzTaskHandler {

    /**
     * 唯一处理器标识
     */
    String handlerKey();

    /**
     * 执行任务
     *
     * @param params 参数对象
     */
    void execute(Map<String, Object> params);
}
