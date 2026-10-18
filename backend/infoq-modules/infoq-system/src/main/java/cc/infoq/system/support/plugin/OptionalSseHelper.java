package cc.infoq.system.support.plugin;

import cc.infoq.common.exception.ServiceException;
import cc.infoq.common.utils.SpringUtils;
import lombok.AccessLevel;
import lombok.NoArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import java.lang.reflect.Method;
import java.util.List;

/**
 * SSE插件可选调用工具.
 */
@Slf4j
@NoArgsConstructor(access = AccessLevel.PRIVATE)
public class OptionalSseHelper {

    private static final String SSE_UTILS_CLASS = "cc.infoq.common.sse.utils.SseMessageUtils";
    private static final String SSE_DTO_CLASS = "cc.infoq.common.sse.dto.SseMessageDto";

    /**
     * 发送用户定向消息.
     */
    public static void publishToUsers(List<Long> userIds, String message) {
        if (!isEnabled()) {
            return;
        }
        try {
            Class<?> dtoClass = Class.forName(SSE_DTO_CLASS);
            Object dto = dtoClass.getDeclaredConstructor().newInstance();
            Method setMessage = dtoClass.getMethod("setMessage", String.class);
            Method setUserIds = dtoClass.getMethod("setUserIds", List.class);
            setMessage.invoke(dto, message);
            setUserIds.invoke(dto, userIds);

            Class<?> utilsClass = Class.forName(SSE_UTILS_CLASS);
            Method publishMessage = utilsClass.getMethod("publishMessage", dtoClass);
            publishMessage.invoke(null, dto);
        } catch (ClassNotFoundException | LinkageError e) {
            log.error("SSE已启用但插件未引入，无法发送定向消息", e);
            throw new ServiceException("SSE已启用但插件未引入，无法发送消息");
        } catch (Exception e) {
            log.error("SSE消息推送失败", e);
            throw new ServiceException("SSE消息推送失败: {}", e.getMessage());
        }
    }

    /**
     * 群发消息.
     */
    public static void publishAll(String message) {
        if (!isEnabled()) {
            return;
        }
        try {
            Class<?> utilsClass = Class.forName(SSE_UTILS_CLASS);
            Method publishAll = utilsClass.getMethod("publishAll", String.class);
            publishAll.invoke(null, message);
        } catch (ClassNotFoundException | LinkageError e) {
            log.error("SSE已启用但插件未引入，无法发送全量消息", e);
            throw new ServiceException("SSE已启用但插件未引入，无法发送全量消息");
        } catch (Exception e) {
            log.error("SSE全量消息推送失败", e);
            throw new ServiceException("SSE全量消息推送失败: {}", e.getMessage());
        }
    }

    private static boolean isEnabled() {
        return Boolean.parseBoolean(SpringUtils.getProperty("sse.enabled", "true"));
    }
}
