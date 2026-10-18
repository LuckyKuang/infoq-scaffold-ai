package cc.infoq.system.service.impl;

import cc.infoq.common.security.auth.LoginUserContext;
import cc.infoq.common.security.auth.SecurityAuthorizationService;
import cc.infoq.common.sensitive.core.SensitiveService;
import cn.hutool.core.util.ArrayUtil;
import lombok.AllArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * 脱敏服务
 * 默认管理员不过滤
 * 需自行根据业务重写实现
 *
 * @author Pontus
 */
@Service
@AllArgsConstructor
public class SysSensitiveServiceImpl implements SensitiveService {

    private final SecurityAuthorizationService securityAuthorizationService;

    /**
     * 是否脱敏
     */
    @Override
    public boolean isSensitive(String[] roleKey, String[] perms) {
        if (!LoginUserContext.isLogin()) {
            return true;
        }
        boolean roleExist = ArrayUtil.isNotEmpty(roleKey);
        boolean permsExist = ArrayUtil.isNotEmpty(perms);
        if (roleExist && permsExist) {
            if (securityAuthorizationService.hasAnyRole(roleKey) && securityAuthorizationService.hasAnyPermission(perms)) {
                return false;
            }
        } else if (roleExist && securityAuthorizationService.hasAnyRole(roleKey)) {
            return false;
        } else if (permsExist && securityAuthorizationService.hasAnyPermission(perms)) {
            return false;
        }

        return !LoginUserContext.isSuperAdmin();
    }

}
