package cc.infoq.common.translation.core.impl;

import cc.infoq.common.service.UserService;
import cc.infoq.common.translation.annotation.TranslationType;
import cc.infoq.common.translation.constant.TransConstant;
import cc.infoq.common.translation.core.TranslationInterface;
import lombok.AllArgsConstructor;

/**
 * 用户名称翻译实现
 *
 * @author Pontus
 */
@AllArgsConstructor
@TranslationType(type = TransConstant.USER_ID_TO_NICKNAME)
public class NicknameTranslationImpl implements TranslationInterface<String> {

    private final UserService userService;

    @Override
    public String translation(Object key, String other) {
        if (key instanceof Long id) {
            return userService.selectNicknameByIds(id.toString());
        } else if (key instanceof String ids) {
            return userService.selectNicknameByIds(ids);
        }
        return null;
    }
}
