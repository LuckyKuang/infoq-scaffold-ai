package cc.infoq.common.enums;

import cc.infoq.common.utils.StringUtils;
import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * 用户类型
 *
 * @author Pontus
 */
@Getter
@AllArgsConstructor
public enum UserType {

    /**
     * 后台系统用户
     */
    SYS_USER("sys_user"),

    /**
     * 移动客户端用户
     */
    APP_USER("app_user");

    /**
     * 用户类型标识（用于 token、权限识别等）
     */
    private final String userType;

    public static UserType getUserType(String str) {
        for (UserType value : values()) {
            if (StringUtils.contains(str, value.getUserType())) {
                return value;
            }
        }
        throw new RuntimeException("'UserType' not found By " + str);
    }
}
