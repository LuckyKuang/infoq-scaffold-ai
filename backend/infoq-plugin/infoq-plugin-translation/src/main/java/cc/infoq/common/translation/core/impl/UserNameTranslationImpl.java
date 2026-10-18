package cc.infoq.common.translation.core.impl;

import cc.infoq.common.service.UserService;
import cc.infoq.common.translation.annotation.TranslationType;
import cc.infoq.common.translation.constant.TransConstant;
import cc.infoq.common.translation.core.TranslationInterface;
import cn.hutool.core.convert.Convert;
import lombok.AllArgsConstructor;

/**
 * 用户名翻译实现
 *
 * @author Pontus
 */
@AllArgsConstructor
@TranslationType(type = TransConstant.USER_ID_TO_NAME)
public class UserNameTranslationImpl implements TranslationInterface<String> {

    private final UserService userService;

    @Override
    public String translation(Object key, String other) {
        return userService.selectUserNameById(Convert.toLong(key));
    }
}
