package cc.infoq.system.domain.bo;

import lombok.Data;

/**
 * 解绑最后一个第三方身份时的密码确认请求。
 */
@Data
public class SysOauthIdentityUnbindBo {

    private String currentPassword;
}
