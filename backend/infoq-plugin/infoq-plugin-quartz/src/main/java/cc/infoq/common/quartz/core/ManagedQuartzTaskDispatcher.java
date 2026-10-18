package cc.infoq.common.quartz.core;

import java.util.Map;
import java.util.Set;

/**
 * 托管 Quartz 任务调度分发器
 *
 * @author Pontus
 */
public interface ManagedQuartzTaskDispatcher {

    /**
     * 获取全部受支持处理器 key
     */
    Set<String> supportedHandlerKeys();

    /**
     * 检查处理器是否存在
     */
    boolean supports(String handlerKey);

    /**
     * 执行指定处理器
     */
    void dispatch(String handlerKey, Map<String, Object> params);
}
