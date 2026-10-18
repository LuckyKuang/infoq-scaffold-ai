package cc.infoq.system.support;

import cc.infoq.common.utils.StringUtils;
import cc.infoq.system.domain.vo.SysClientVo;
import lombok.AccessLevel;
import lombok.NoArgsConstructor;

@NoArgsConstructor(access = AccessLevel.PRIVATE)
public final class AuthGrantUtils {

    public static boolean supportsGrantType(SysClientVo client, String grantType) {
        if (client == null || StringUtils.isBlank(grantType)) {
            return false;
        }
        return StringUtils.splitList(client.getGrantType()).stream()
            .map(StringUtils::trim)
            .anyMatch(value -> StringUtils.equals(value, grantType));
    }
}
