package cc.infoq.system.domain.vo;

import cc.infoq.system.domain.entity.SysOauthIdentity;
import io.github.linpeilie.annotations.AutoMapper;
import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.util.Date;

/**
 * OAuth 身份绑定视图对象
 */
@Data
@AutoMapper(target = SysOauthIdentity.class)
public class SysOauthIdentityVo implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    private Long identityId;

    private Long userId;

    private String providerCode;

    private String providerKey;

    private String providerSubject;

    private String unionId;

    private String openId;

    private String providerUsername;

    private String providerNickname;

    private String providerEmail;

    private String providerAvatar;

    private String emailVerified;

    private String metadataJson;

    private String status;

    private Date lastLoginTime;
}
