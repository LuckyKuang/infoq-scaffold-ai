package cc.infoq.system.domain.vo;

import cc.infoq.system.domain.entity.SysOauthProvider;
import io.github.linpeilie.annotations.AutoMapper;
import lombok.Data;

import java.io.Serial;
import java.io.Serializable;

/**
 * OAuth 提供方视图对象
 */
@Data
@AutoMapper(target = SysOauthProvider.class)
public class SysOauthProviderVo implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    private Long providerId;

    private String providerCode;

    private String providerName;

    private String enabled;

    private String allowLogin;

    private String allowBind;

    private String allowAutoRegister;

    private Integer sort;

    private String remark;
}
