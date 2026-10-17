package cc.infoq.system.service;

import cc.infoq.common.domain.model.RegisterBody;

/**
 * 注册校验方法
 *
 * @author Pontus
 */
public interface SysRegisterService {

    /**
     * 注册
     */
    void register(RegisterBody registerBody);
}
