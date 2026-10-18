package cc.infoq.common.push.domain;

/**
 * Push 接收方，只承载内部用户标识。
 */
public record PushRecipient(Long userId) {
}
