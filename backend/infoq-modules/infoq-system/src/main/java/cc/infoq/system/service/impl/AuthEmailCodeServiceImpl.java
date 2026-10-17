package cc.infoq.system.service.impl;

import cc.infoq.common.constant.Constants;
import cc.infoq.common.constant.GlobalConstants;
import cc.infoq.common.enums.EmailCodeScene;
import cc.infoq.common.exception.ServiceException;
import cc.infoq.common.exception.user.CaptchaExpireException;
import cc.infoq.common.redis.utils.RedisUtils;
import cc.infoq.common.utils.StringUtils;
import cc.infoq.system.service.AuthEmailCodeService;
import cc.infoq.system.support.plugin.OptionalMailHelper;
import cn.hutool.core.util.RandomUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Duration;

/**
 * 邮件验证码服务实现
 *
 * @author Pontus
 */
@Slf4j
@Service
public class AuthEmailCodeServiceImpl implements AuthEmailCodeService {

    @Override
    public void sendCode(EmailCodeScene scene, String email) {
        String code = RandomUtil.randomNumbers(4);
        RedisUtils.setCacheObject(buildCacheKey(scene, email), code, Duration.ofMinutes(Constants.CAPTCHA_EXPIRATION));
        try {
            OptionalMailHelper.sendText(
                email,
                scene.getSubject(),
                StringUtils.format(scene.getTemplate(), code, Constants.CAPTCHA_EXPIRATION)
            );
        } catch (RuntimeException e) {
            log.error("邮件验证码发送异常 => {}", e.getMessage());
            throw new ServiceException(e.getMessage());
        }
    }

    @Override
    public boolean validateCode(EmailCodeScene scene, String email, String emailCode) {
        String verifyKey = buildCacheKey(scene, email);
        String code = RedisUtils.getCacheObject(verifyKey);
        RedisUtils.deleteObject(verifyKey);
        if (StringUtils.isBlank(code)) {
            throw new CaptchaExpireException();
        }
        return StringUtils.equals(code, emailCode);
    }

    private String buildCacheKey(EmailCodeScene scene, String email) {
        return GlobalConstants.CAPTCHA_CODE_KEY + scene.getCode() + ":" + email;
    }
}
