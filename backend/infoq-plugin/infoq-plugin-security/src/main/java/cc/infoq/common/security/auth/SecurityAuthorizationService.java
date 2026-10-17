package cc.infoq.common.security.auth;

import cc.infoq.common.domain.model.LoginUser;
import cc.infoq.common.utils.StringUtils;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.List;
import java.util.Set;

@Service(SecurityAuthorizationService.BEAN_NAME)
public class SecurityAuthorizationService {

    public static final String BEAN_NAME = "securityAuthorizationService";

    private static final String ALL_PERMISSION = "*:*:*";

    private final CurrentUserService currentUserService;

    public SecurityAuthorizationService(CurrentUserService currentUserService) {
        this.currentUserService = currentUserService;
    }

    public boolean hasPermission(String permission) {
        return hasAnyPermission(permission);
    }

    public boolean hasAnyPermission(String... permissions) {
        LoginUser loginUser = requireLoginUser();
        List<String> requiredPermissions = nonBlankValues(permissions);
        if (requiredPermissions.isEmpty()) {
            return false;
        }
        if (currentUserService.isSuperAdmin(loginUser.getUserId())) {
            return true;
        }
        Set<String> grantedPermissions = loginUser.getMenuPermission();
        if (grantedPermissions == null || grantedPermissions.isEmpty()) {
            return false;
        }
        if (grantedPermissions.contains(ALL_PERMISSION)) {
            return true;
        }
        return requiredPermissions.stream().anyMatch(grantedPermissions::contains);
    }

    public boolean hasAllPermissions(String... permissions) {
        LoginUser loginUser = requireLoginUser();
        List<String> requiredPermissions = nonBlankValues(permissions);
        if (requiredPermissions.isEmpty()) {
            return false;
        }
        if (currentUserService.isSuperAdmin(loginUser.getUserId())) {
            return true;
        }
        Set<String> grantedPermissions = loginUser.getMenuPermission();
        if (grantedPermissions == null || grantedPermissions.isEmpty()) {
            return false;
        }
        if (grantedPermissions.contains(ALL_PERMISSION)) {
            return true;
        }
        return requiredPermissions.stream().allMatch(grantedPermissions::contains);
    }

    public boolean hasRole(String role) {
        return hasAnyRole(role);
    }

    public boolean hasAnyRole(String... roles) {
        LoginUser loginUser = requireLoginUser();
        List<String> requiredRoles = nonBlankValues(roles);
        if (requiredRoles.isEmpty()) {
            return false;
        }
        if (currentUserService.isSuperAdmin(loginUser.getUserId())) {
            return true;
        }
        Set<String> grantedRoles = loginUser.getRolePermission();
        if (grantedRoles == null || grantedRoles.isEmpty()) {
            return false;
        }
        return requiredRoles.stream().anyMatch(grantedRoles::contains);
    }

    public boolean hasAllRoles(String... roles) {
        LoginUser loginUser = requireLoginUser();
        List<String> requiredRoles = nonBlankValues(roles);
        if (requiredRoles.isEmpty()) {
            return false;
        }
        if (currentUserService.isSuperAdmin(loginUser.getUserId())) {
            return true;
        }
        Set<String> grantedRoles = loginUser.getRolePermission();
        if (grantedRoles == null || grantedRoles.isEmpty()) {
            return false;
        }
        return requiredRoles.stream().allMatch(grantedRoles::contains);
    }

    private LoginUser requireLoginUser() {
        try {
            LoginUser loginUser = currentUserService.getLoginUser();
            if (loginUser == null) {
                throw new SecurityAuthenticationException("LoginUser is missing from token session");
            }
            return loginUser;
        } catch (SecurityAuthenticationException ex) {
            throw new AuthenticationCredentialsNotFoundException("Current security authentication is required", ex);
        }
    }

    private List<String> nonBlankValues(String... values) {
        if (values == null || values.length == 0) {
            return List.of();
        }
        return Arrays.stream(values)
            .filter(StringUtils::isNotBlank)
            .toList();
    }

}
