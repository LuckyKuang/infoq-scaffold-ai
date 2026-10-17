package cc.infoq.common.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * 登录类型
 *
 * @author Pontus
 */
@Getter
@AllArgsConstructor
public enum LoginType {

    /**
     * 密码登录
     */
    PASSWORD("user.password.retry.limit.exceed", "user.password.retry.limit.count"),

    /**
     * 邮箱登录
     */
    EMAIL("email.code.retry.limit.exceed", "email.code.retry.limit.count");

    /**
     * 登录重试超出限制提示
     */
    final String retryLimitExceed;

    /**
     * 登录重试限制计数提示
     */
    final String retryLimitCount;
}
