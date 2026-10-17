package cc.infoq.common.quartz.core;

import cc.infoq.common.exception.ServiceException;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 托管 Quartz 任务分发实现
 *
 * @author Pontus
 */
@RequiredArgsConstructor
@Component
@ConditionalOnProperty(prefix = "infoq.quartz", name = "enabled", havingValue = "true", matchIfMissing = true)
public class ManagedQuartzTaskDispatcherImpl implements ManagedQuartzTaskDispatcher {

    private final List<ManagedQuartzTaskHandler> handlers;

    @Override
    public Set<String> supportedHandlerKeys() {
        return handlers.stream()
            .map(ManagedQuartzTaskHandler::handlerKey)
            .collect(Collectors.toUnmodifiableSet());
    }

    @Override
    public boolean supports(String handlerKey) {
        return findHandlerMap().containsKey(handlerKey);
    }

    @Override
    public void dispatch(String handlerKey, Map<String, Object> params) {
        ManagedQuartzTaskHandler handler = findHandlerMap().get(handlerKey);
        if (handler == null) {
            throw new ServiceException("未注册的定时任务处理器: {}", handlerKey);
        }
        handler.execute(params);
    }

    private Map<String, ManagedQuartzTaskHandler> findHandlerMap() {
        return handlers.stream().collect(Collectors.toMap(ManagedQuartzTaskHandler::handlerKey, Function.identity()));
    }
}
