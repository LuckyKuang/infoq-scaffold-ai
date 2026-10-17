package cc.infoq.common.translation.core.impl;

import cc.infoq.common.service.DictService;
import cc.infoq.common.translation.annotation.TranslationType;
import cc.infoq.common.translation.constant.TransConstant;
import cc.infoq.common.translation.core.TranslationInterface;
import cc.infoq.common.utils.StringUtils;
import lombok.AllArgsConstructor;

/**
 * 字典翻译实现
 *
 * @author Pontus
 */
@AllArgsConstructor
@TranslationType(type = TransConstant.DICT_TYPE_TO_LABEL)
public class DictTypeTranslationImpl implements TranslationInterface<String> {

    private final DictService dictService;

    @Override
    public String translation(Object key, String other) {
        if (key instanceof String dictValue && StringUtils.isNotBlank(other)) {
            return dictService.getDictLabel(other, dictValue);
        }
        return null;
    }
}
