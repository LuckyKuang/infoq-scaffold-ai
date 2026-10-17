package cc.infoq.common.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * 邀请码状态.
 *
 * @author Pontus
 */
@Getter
@AllArgsConstructor
public enum InviteCodeStatus {

    /**
     * 未使用.
     */
    UNUSED("0", "未使用"),

    /**
     * 已使用.
     */
    USED("1", "已使用"),

    /**
     * 已作废.
     */
    CANCELED("2", "已作废"),

    /**
     * 已过期.
     */
    EXPIRED("3", "已过期");

    private final String code;
    private final String info;
}
