package cc.infoq.system.domain.vo;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;

/**
 * 登录页 OAuth 提供方选项
 */
@Data
public class OAuthProviderOptionVo implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    private String providerCode;

    private String providerName;
}
