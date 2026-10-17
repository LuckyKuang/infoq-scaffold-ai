package cc.infoq.system.service;

import cc.infoq.common.mybatis.core.page.PageQuery;
import cc.infoq.common.mybatis.core.page.TableDataInfo;
import cc.infoq.system.domain.bo.SysJobLogBo;
import cc.infoq.system.domain.vo.SysJobLogVo;

import java.util.List;

/**
 * 定时任务日志 Service 接口
 *
 * @author Pontus
 */
public interface SysJobLogService {

    TableDataInfo<SysJobLogVo> queryPageList(SysJobLogBo bo, PageQuery pageQuery);

    List<SysJobLogVo> queryList(SysJobLogBo bo);

    SysJobLogVo queryById(Long jobLogId);

    void recordStart(Long jobLogId, Long jobId, String jobName, String jobGroup, String handlerKey,
        String handlerParams, String triggerSource);

    void recordSuccess(Long jobLogId, String message, long durationMs);

    void recordFailure(Long jobLogId, String message, String exceptionInfo, long durationMs);

    boolean deleteByIds(Long[] jobLogIds);

    void clean();
}
