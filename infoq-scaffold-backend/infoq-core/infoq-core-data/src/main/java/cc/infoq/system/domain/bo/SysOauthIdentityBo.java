package cc.infoq.system.domain.bo;

import cc.infoq.common.mybatis.core.domain.BaseEntity;
import cc.infoq.system.domain.entity.SysOauthIdentity;
import io.github.linpeilie.annotations.AutoMapper;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * OAuth 身份绑定业务对象
 */
@Data
@EqualsAndHashCode(callSuper = true)
@AutoMapper(target = SysOauthIdentity.class, reverseConvertGenerate = false)
public class SysOauthIdentityBo extends BaseEntity {

    private Long identityId;

    private Long userId;

    private String providerCode;

    private String providerKey;

    private String providerSubject;
}
