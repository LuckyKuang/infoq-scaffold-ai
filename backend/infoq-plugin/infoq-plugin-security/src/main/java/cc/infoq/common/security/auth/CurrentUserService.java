package cc.infoq.common.security.auth;

import cc.infoq.common.constant.SystemConstants;
import cc.infoq.common.domain.model.LoginUser;
import cc.infoq.common.enums.UserType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Component
public class CurrentUserService {

    public SecurityTokenAuthentication getAuthentication() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new SecurityAuthenticationException("Spring Security authentication is missing");
        }
        Object principal = authentication.getPrincipal();
        if (principal instanceof SecurityTokenAuthentication tokenAuthentication) {
            return tokenAuthentication;
        }
        throw new SecurityAuthenticationException("Spring Security principal is not a security token session");
    }

    public LoginUser getLoginUser() {
        LoginUser loginUser = getAuthentication().loginUser();
        if (loginUser == null) {
            throw new SecurityAuthenticationException("LoginUser is missing from token session");
        }
        return loginUser;
    }

    public Long getUserId() {
        return getLoginUser().getUserId();
    }

    public String getUserIdStr() {
        Long userId = getUserId();
        return userId == null ? null : userId.toString();
    }

    public String getUsername() {
        return getLoginUser().getUsername();
    }

    public Long getDeptId() {
        return getLoginUser().getDeptId();
    }

    public String getDeptName() {
        return getLoginUser().getDeptName();
    }

    public String getDeptCategory() {
        return getLoginUser().getDeptCategory();
    }

    public UserType getUserType() {
        return UserType.getUserType(getLoginUser().getLoginId());
    }

    public boolean isSuperAdmin(Long userId) {
        return SystemConstants.SUPER_ADMIN_ID.equals(userId);
    }

    public boolean isSuperAdmin() {
        return isSuperAdmin(getUserId());
    }

    public boolean isLogin() {
        try {
            getAuthentication();
            return true;
        } catch (SecurityAuthenticationException ignored) {
            return false;
        }
    }

}
