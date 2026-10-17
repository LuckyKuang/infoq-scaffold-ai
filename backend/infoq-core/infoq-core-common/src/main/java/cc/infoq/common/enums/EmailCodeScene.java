package cc.infoq.common.enums;

import cc.infoq.common.exception.ServiceException;
import cc.infoq.common.utils.StringUtils;
import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * 邮件验证码场景
 *
 * @author Pontus
 */
@Getter
@AllArgsConstructor
public enum EmailCodeScene {

    REGISTER("register", "注册验证码", "您本次注册验证码为：{}，有效期为{}分钟，请尽快完成注册。"),
    FORGOT_PASSWORD("forgot_password", "重置密码验证码", "您本次重置密码验证码为：{}，有效期为{}分钟，请尽快完成密码重置。"),
    EMAIL_LOGIN("email_login", "登录验证码", "您本次登录验证码为：{}，有效期为{}分钟，请尽快填写。");

    private final String code;
    private final String subject;
    private final String template;

    public static EmailCodeScene fromCode(String code) {
        for (EmailCodeScene value : values()) {
            if (StringUtils.equals(value.code, code)) {
                return value;
            }
        }
        throw new ServiceException("不支持的邮件验证码场景");
    }
}
