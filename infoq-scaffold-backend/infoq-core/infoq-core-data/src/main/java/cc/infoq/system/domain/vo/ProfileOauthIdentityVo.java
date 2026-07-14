package cc.infoq.system.domain.vo;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.util.Date;

/**
 * 个人中心展示的外部身份摘要，不暴露第三方主体标识。
 */
@Data
public class ProfileOauthIdentityVo implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    private Long identityId;

    private String providerCode;

    private String providerName;

    private String status;

    /** 解绑该身份前是否必须验证当前密码。 */
    private Boolean passwordConfirmationRequired;

    private Date lastLoginTime;

    private Date createTime;
}
