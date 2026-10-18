package cc.infoq.system.service;

import cc.infoq.common.domain.model.ForgotPasswordBody;

/**
 * 未登录态忘记密码服务
 *
 * @author Pontus
 */
public interface SysForgotPasswordService {

    /**
     * 通过邮箱验证码重置密码
     */
    void resetPassword(ForgotPasswordBody body);
}
