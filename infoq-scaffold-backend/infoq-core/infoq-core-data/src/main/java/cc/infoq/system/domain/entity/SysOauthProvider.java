package cc.infoq.system.domain.entity;

import cc.infoq.common.mybatis.core.domain.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.io.Serial;

/**
 * OAuth 提供方配置
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("sys_oauth_provider")
public class SysOauthProvider extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    @TableId(value = "provider_id")
    private Long providerId;

    private String providerCode;

    private String providerName;

    private String enabled;

    private String allowLogin;

    private String allowBind;

    private String allowAutoRegister;

    private Integer sort;

    private String remark;

    @TableLogic
    private String delFlag;
}
