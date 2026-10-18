package cc.infoq.common.domain.model;

import cc.infoq.common.constant.RegexConstants;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;
import org.hibernate.validator.constraints.Length;

import java.io.Serial;
import java.io.Serializable;

/**
 * 忘记密码重置请求
 *
 * @author Pontus
 */
@Data
public class ForgotPasswordBody implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 邮箱
     */
    @NotBlank(message = "{user.email.not.blank}")
    @Email(message = "{user.email.not.valid}")
    private String email;

    /**
     * 邮箱验证码
     */
    @NotBlank(message = "{email.code.not.blank}")
    private String emailCode;

    /**
     * 新密码
     */
    @NotBlank(message = "{user.password.not.blank}")
    @Length(min = 8, max = 30, message = "{user.password.length.valid}")
    @Pattern(regexp = RegexConstants.PASSWORD, message = "{user.password.format.valid}")
    private String newPassword;
}
