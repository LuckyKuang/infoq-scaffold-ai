package cc.infoq.system.service.impl;

import cc.infoq.common.domain.model.ForgotPasswordBody;
import cc.infoq.common.enums.EmailCodeScene;
import cc.infoq.common.exception.ServiceException;
import cc.infoq.common.exception.user.CaptchaException;
import cc.infoq.common.utils.MessageUtils;
import cc.infoq.system.domain.entity.SysUser;
import cc.infoq.system.domain.vo.SysUserVo;
import cc.infoq.system.mapper.SysUserMapper;
import cc.infoq.system.service.AuthEmailCodeService;
import cc.infoq.system.service.SysForgotPasswordService;
import cc.infoq.system.service.SysLoginService;
import cc.infoq.system.service.SysUserService;
import cn.hutool.crypto.digest.BCrypt;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * 未登录态忘记密码服务实现
 *
 * @author Pontus
 */
@RequiredArgsConstructor
@Service
public class SysForgotPasswordServiceImpl implements SysForgotPasswordService {

    private final AuthEmailCodeService authEmailCodeService;
    private final SysUserMapper userMapper;
    private final SysUserService sysUserService;
    private final SysLoginService sysLoginService;

    @Override
    public void resetPassword(ForgotPasswordBody body) {
        SysUserVo user = userMapper.selectVoOne(new LambdaQueryWrapper<SysUser>()
            .eq(SysUser::getEmail, body.getEmail()));
        if (user == null) {
            throw new ServiceException(MessageUtils.message("user.forgot.password.invalid"));
        }
        if (!authEmailCodeService.validateCode(EmailCodeScene.FORGOT_PASSWORD, body.getEmail(), body.getEmailCode())) {
            throw new CaptchaException();
        }
        sysUserService.resetUserPwd(user.getUserId(), BCrypt.hashpw(body.getNewPassword()));
        sysLoginService.invalidateUserSessions(user.getUserId(), user.getUserType());
    }
}
