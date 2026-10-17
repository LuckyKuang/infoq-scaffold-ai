package cc.infoq.system.domain.vo;

import lombok.Data;

/**
 * 验证码信息
 *
 * @author Pontus
 */
@Data
public class CaptchaVo {

    /**
     * 是否开启验证码
     */
    private Boolean captchaEnabled = true;

    /**
     * 唯一码
     */
    private String uuid;

    /**
     * 验证码图片
     */
    private String img;

    /**
     * 是否开启注册
     */
    private Boolean registerEnabled = false;

    /**
     * 是否开启忘记密码
     */
    private Boolean forgotPasswordEnabled = false;

    /**
     * 是否开启邮件能力
     */
    private Boolean mailEnabled = false;

    /**
     * 是否开启邀请码注册
     */
    private Boolean inviteRegisterEnabled = false;

}
