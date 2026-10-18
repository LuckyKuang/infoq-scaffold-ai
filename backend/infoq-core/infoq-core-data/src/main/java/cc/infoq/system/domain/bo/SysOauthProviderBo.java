package cc.infoq.system.domain.bo;

import cc.infoq.common.mybatis.core.domain.BaseEntity;
import cc.infoq.system.domain.entity.SysOauthProvider;
import io.github.linpeilie.annotations.AutoMapper;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * OAuth 提供方业务对象
 */
@Data
@EqualsAndHashCode(callSuper = true)
@AutoMapper(target = SysOauthProvider.class, reverseConvertGenerate = false)
public class SysOauthProviderBo extends BaseEntity {

    private Long providerId;

    private String providerCode;

    private String providerName;

    private String enabled;

    private String allowLogin;

    private String allowBind;

    private String allowAutoRegister;
}
