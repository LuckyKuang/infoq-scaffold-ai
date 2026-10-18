package cc.infoq.system.domain.entity;

import cc.infoq.common.mybatis.core.domain.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.io.Serial;
import java.util.Date;

/**
 * OAuth 身份绑定
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("sys_oauth_identity")
public class SysOauthIdentity extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    @TableId(value = "identity_id")
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

    @TableLogic
    private String delFlag;
}
