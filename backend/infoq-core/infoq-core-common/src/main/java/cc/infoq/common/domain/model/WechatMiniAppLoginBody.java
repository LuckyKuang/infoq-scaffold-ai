package cc.infoq.common.domain.model;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * 微信小程序 code 登录请求。
 */
@Data
@EqualsAndHashCode(callSuper = true)
public class WechatMiniAppLoginBody extends LoginBody {

    @NotBlank(message = "{auth.wechat.miniapp.code.not.blank}")
    private String code;
}
