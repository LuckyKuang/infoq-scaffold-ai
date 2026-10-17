package cc.infoq.system.service;

import cc.infoq.system.domain.vo.DataSourceMonitorVo;

/**
 * 数据源监控 Service 接口
 *
 * @author Pontus
 */
public interface DataSourceMonitorService {

    DataSourceMonitorVo getMonitorInfo();
}
