package cc.infoq.common.security.auth;

import cc.infoq.common.domain.model.LoginUser;
import cc.infoq.common.enums.UserType;
import cc.infoq.common.utils.SpringUtils;
import lombok.AccessLevel;
import lombok.NoArgsConstructor;

@NoArgsConstructor(access = AccessLevel.PRIVATE)
public final class LoginUserContext {

    private static volatile CurrentUserService currentUserService;

    public static void setCurrentUserService(CurrentUserService service) {
        currentUserService = service;
    }

    public static LoginUser getLoginUser() {
        return service().getLoginUser();
    }

    public static Long getUserId() {
        return service().getUserId();
    }

    public static String getUserIdStr() {
        return service().getUserIdStr();
    }

    public static String getUsername() {
        return service().getUsername();
    }

    public static Long getDeptId() {
        return service().getDeptId();
    }

    public static String getDeptName() {
        return service().getDeptName();
    }

    public static String getDeptCategory() {
        return service().getDeptCategory();
    }

    public static UserType getUserType() {
        return service().getUserType();
    }

    public static boolean isSuperAdmin(Long userId) {
        return service().isSuperAdmin(userId);
    }

    public static boolean isSuperAdmin() {
        return service().isSuperAdmin();
    }

    public static boolean isLogin() {
        return service().isLogin();
    }

    private static CurrentUserService service() {
        CurrentUserService service = currentUserService;
        if (service != null) {
            return service;
        }
        try {
            return SpringUtils.getBean(CurrentUserService.class);
        } catch (RuntimeException e) {
            throw new SecurityAuthenticationException("CurrentUserService bean is not available", e);
        }
    }

}
