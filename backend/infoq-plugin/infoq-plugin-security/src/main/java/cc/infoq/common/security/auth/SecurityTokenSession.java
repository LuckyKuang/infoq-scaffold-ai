package cc.infoq.common.security.auth;

import cc.infoq.common.domain.dto.UserOnlineDTO;
import cc.infoq.common.domain.model.LoginUser;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serial;
import java.io.Serializable;
import java.util.HashSet;
import java.util.Set;

@Data
@NoArgsConstructor
public class SecurityTokenSession implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    private String jwtId;

    private String tokenDigest;

    /**
     * 保持现有在线用户 tokenId 契约
     */
    private String accessToken;

    private String loginId;

    private Long userId;

    private String userType;

    private String clientId;

    private String deviceType;

    private Long loginTime;

    private Long expireTime;

    private Long activeExpireTime;

    private Long lastAccessTime;

    private LoginUser loginUser;

    private UserOnlineDTO onlineUser;

    private Set<Long> roleIds = new HashSet<>();

    public boolean isExpired(long nowMillis) {
        return expireTime != null && expireTime > 0 && nowMillis > expireTime;
    }

    public boolean isActiveExpired(long nowMillis) {
        return activeExpireTime != null && activeExpireTime > 0 && nowMillis > activeExpireTime;
    }

}
