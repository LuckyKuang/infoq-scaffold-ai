package cc.infoq.system.service.impl;

import cc.infoq.common.constant.SystemConstants;
import cc.infoq.common.security.auth.LoginUserContext;
import cc.infoq.common.service.PermissionService;
import cc.infoq.system.service.SysMenuService;
import cc.infoq.system.service.SysPermissionService;
import cc.infoq.system.service.SysRoleService;
import lombok.AllArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.Set;

/**
 * 用户权限处理
 *
 * @author Pontus
 */
@AllArgsConstructor
@Service
public class SysPermissionServiceImpl implements SysPermissionService, PermissionService {

    private final SysRoleService sysRoleService;
    private final SysMenuService sysMenuService;

    /**
     * 获取角色数据权限
     *
     * @param userId  用户id
     * @return 角色权限信息
     */
    @Override
    public Set<String> getRolePermission(Long userId) {
        Set<String> roles = new HashSet<>();
        // 管理员拥有所有权限
        if (LoginUserContext.isSuperAdmin(userId)) {
            roles.add(SystemConstants.SUPER_ADMIN_ROLE_KEY);
        } else {
            roles.addAll(sysRoleService.selectRolePermissionByUserId(userId));
        }
        return roles;
    }

    /**
     * 获取菜单数据权限
     *
     * @param userId  用户id
     * @return 菜单权限信息
     */
    @Override
    public Set<String> getMenuPermission(Long userId) {
        Set<String> perms = new HashSet<>();
        // 管理员拥有所有权限
        if (LoginUserContext.isSuperAdmin(userId)) {
            perms.add("*:*:*");
        } else {
            perms.addAll(sysMenuService.selectMenuPermsByUserId(userId));
        }
        return perms;
    }
}
