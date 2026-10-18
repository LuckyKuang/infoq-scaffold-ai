package cc.infoq.common.domain.model;

import cc.infoq.common.constant.RegexConstants;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

import java.io.Serial;
import java.io.Serializable;

/**
 * 发送邮件验证码请求
 *
 * @author Pontus
 */
@Data
public class SendEmailCodeBody implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 邮箱
     */
    @NotBlank(message = "{user.email.not.blank}")
    @Email(message = "{user.email.not.valid}")
    private String email;

    /**
     * 场景
     */
    @NotBlank(message = "{email.code.scene.not.blank}")
    @Pattern(regexp = RegexConstants.EMAIL_CODE_SCENE, message = "{email.code.scene.not.valid}")
    private String scene;

    /**
     * 图形验证码
     */
    private String code;

    /**
     * 图形验证码 uuid
     */
    private String uuid;

    /**
     * 邀请码
     */
    private String inviteCode;
}
