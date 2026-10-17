package cc.infoq.system.service;

import cc.infoq.system.domain.vo.ServerMonitorVo;

/**
 * 服务监控 Service 接口
 *
 * @author Pontus
 */
public interface ServerMonitorService {

    ServerMonitorVo getMonitorInfo();
}
