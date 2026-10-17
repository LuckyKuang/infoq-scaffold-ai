package cc.infoq.common.security.auth;

import cc.infoq.common.domain.dto.UserOnlineDTO;
import cc.infoq.common.domain.model.LoginUser;

public record SecurityTokenIssueRequest(
    LoginUser loginUser,
    String clientId,
    String deviceType,
    Long timeoutSeconds,
    Long activeTimeoutSeconds,
    UserOnlineDTO onlineUser
) {
}
