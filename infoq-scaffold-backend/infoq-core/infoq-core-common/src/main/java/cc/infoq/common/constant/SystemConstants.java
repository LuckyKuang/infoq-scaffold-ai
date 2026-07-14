package cc.infoq.common.constant;

/**
 * 系统常量信息
 *
 * @author Pontus
 */
public interface SystemConstants {

    /**
     * 正常状态
     */
    String NORMAL = "0";

    /**
     * 异常状态
     */
    String DISABLE = "1";

    /**
     * 是否为系统默认（是）
     */
    String YES = "Y";

    /**
     * 是否为系统默认（否）
     */
    String NO = "N";

    /**
     * 是否菜单外链（是）
     */
    String YES_FRAME = "0";

    /**
     * 是否菜单外链（否）
     */
    String NO_FRAME = "1";

    /**
     * 菜单类型（目录）
     */
    String TYPE_DIR = "M";

    /**
     * 菜单类型（菜单）
     */
    String TYPE_MENU = "C";

    /**
     * 菜单类型（按钮）
     */
    String TYPE_BUTTON = "F";

    /**
     * Layout组件标识
     */
    String LAYOUT = "Layout";

    /**
     * ParentView组件标识
     */
    String PARENT_VIEW = "ParentView";

    /**
     * InnerLink组件标识
     */
    String INNER_LINK = "InnerLink";

    /**
     * 超级管理员ID
     */
    Long SUPER_ADMIN_ID = 1L;

    /**
     * 超级管理员角色标识
     */
    String SUPER_ADMIN_ROLE_KEY = "superadmin";

    /**
     * 帐号自助-是否开启注册
     */
    String ACCOUNT_REGISTER_CONFIG_KEY = "sys.account.registerUser";

    /**
     * 帐号自助-是否开启邀请码注册
     */
    String ACCOUNT_INVITE_REGISTER_CONFIG_KEY = "sys.account.inviteRegister";

    /**
     * 帐号自助-是否开启忘记密码
     */
    String ACCOUNT_FORGOT_PASSWORD_CONFIG_KEY = "sys.account.forgotPassword";

    /**
     * OAuth 授权类型
     */
    String GRANT_TYPE_OAUTH = "oauth";

    /**
     * 微信小程序授权类型
     */
    String GRANT_TYPE_WECHAT_MINIAPP = "xcx";

    /**
     * 系统管理员角色标识
     */
    String ADMIN_ROLE_KEY = "admin";

    /**
     * 根部门祖级列表
     */
    String ROOT_DEPT_ANCESTORS = "0";

    /**
     * 默认部门 ID
     */
    Long DEFAULT_DEPT_ID = 100L;

    /**
     * 公开注册默认部门 ID
     */
    Long REGISTER_DEFAULT_DEPT_ID = 112L;

    /**
     * 公开注册默认角色 role_key
     */
    String REGISTER_DEFAULT_ROLE_KEY = "owner";

    /**
     * 公开注册默认岗位 post_code
     */
    String REGISTER_DEFAULT_POST_CODE = "user";

    /**
     * 排除敏感属性字段
     */
    String[] EXCLUDE_PROPERTIES = { "password", "oldPassword", "newPassword", "confirmPassword" };

}
