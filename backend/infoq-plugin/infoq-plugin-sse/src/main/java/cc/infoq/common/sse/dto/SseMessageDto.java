package cc.infoq.common.sse.dto;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.util.List;

/**
 * 消息的dto
 *
 * @author Pontus
 */
@Data
public class SseMessageDto implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 需要推送到的session key 列表
     */
    private List<Long> userIds;

    /**
     * 需要发送的消息
     */
    private String message;

    /**
     * 发布消息的节点标识，用于避免本节点 Redis 订阅回环造成重复推送。
     */
    private String sourceNodeId;
}
