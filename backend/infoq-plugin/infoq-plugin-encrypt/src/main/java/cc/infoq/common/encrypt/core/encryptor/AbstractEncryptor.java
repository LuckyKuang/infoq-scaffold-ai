package cc.infoq.common.encrypt.core.encryptor;

import cc.infoq.common.encrypt.core.EncryptContext;
import cc.infoq.common.encrypt.core.IEncryptor;

/**
 * 所有加密执行者的基类
 *
 * @author Pontus
 */
public abstract class AbstractEncryptor implements IEncryptor {

    public AbstractEncryptor(EncryptContext context) {
        // 用户配置校验与配置注入
    }

}
