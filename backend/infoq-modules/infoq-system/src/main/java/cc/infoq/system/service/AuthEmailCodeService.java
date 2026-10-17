package cc.infoq.system.service;

import cc.infoq.common.enums.EmailCodeScene;

/**
 * 邮件验证码服务
 *
 * @author Pontus
 */
public interface AuthEmailCodeService {

    /**
     * 发送验证码
     */
    void sendCode(EmailCodeScene scene, String email);

    /**
     * 校验验证码
     *
     * @return true 表示匹配成功
     */
    boolean validateCode(EmailCodeScene scene, String email, String emailCode);
}
