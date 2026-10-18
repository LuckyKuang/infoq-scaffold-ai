package cc.infoq.system.service.impl;

import cc.infoq.common.constant.Constants;
import cc.infoq.common.mybatis.core.page.PageQuery;
import cc.infoq.common.mybatis.core.page.TableDataInfo;
import cc.infoq.common.utils.StringUtils;
import cc.infoq.system.domain.bo.SysJobLogBo;
import cc.infoq.system.domain.entity.SysJobLog;
import cc.infoq.system.domain.vo.SysJobLogVo;
import cc.infoq.system.mapper.SysJobLogMapper;
import cc.infoq.system.service.SysJobLogService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.Date;
import java.util.List;
import java.util.Map;

/**
 * 定时任务日志 Service 实现
 *
 * @author Pontus
 */
@Service
@RequiredArgsConstructor
public class SysJobLogServiceImpl implements SysJobLogService {

    private final SysJobLogMapper sysJobLogMapper;

    @Override
    public TableDataInfo<SysJobLogVo> queryPageList(SysJobLogBo bo, PageQuery pageQuery) {
        LambdaQueryWrapper<SysJobLog> lqw = buildQueryWrapper(bo);
        if (StringUtils.isBlank(pageQuery.getOrderByColumn())) {
            lqw.orderByDesc(SysJobLog::getJobLogId);
        }
        Page<SysJobLogVo> page = sysJobLogMapper.selectVoPage(pageQuery.build(), lqw);
        return TableDataInfo.build(page);
    }

    @Override
    public List<SysJobLogVo> queryList(SysJobLogBo bo) {
        return sysJobLogMapper.selectVoList(buildQueryWrapper(bo).orderByDesc(SysJobLog::getJobLogId));
    }

    @Override
    public SysJobLogVo queryById(Long jobLogId) {
        return sysJobLogMapper.selectVoById(jobLogId);
    }

    @Override
    public void recordStart(Long jobLogId, Long jobId, String jobName, String jobGroup, String handlerKey,
        String handlerParams, String triggerSource) {
        SysJobLog entity = new SysJobLog();
        entity.setJobLogId(jobLogId);
        entity.setJobId(jobId);
        entity.setJobName(jobName);
        entity.setJobGroup(jobGroup);
        entity.setHandlerKey(handlerKey);
        entity.setHandlerParams(handlerParams);
        entity.setTriggerSource(triggerSource);
        entity.setStatus(Constants.SUCCESS);
        entity.setJobMessage("任务开始执行");
        entity.setStartTime(new Date());
        sysJobLogMapper.insert(entity);
    }

    @Override
    public void recordSuccess(Long jobLogId, String message, long durationMs) {
        SysJobLog entity = new SysJobLog();
        entity.setJobLogId(jobLogId);
        entity.setJobMessage(message);
        entity.setStatus(Constants.SUCCESS);
        entity.setDurationMs(durationMs);
        entity.setEndTime(new Date());
        sysJobLogMapper.updateById(entity);
    }

    @Override
    public void recordFailure(Long jobLogId, String message, String exceptionInfo, long durationMs) {
        SysJobLog entity = new SysJobLog();
        entity.setJobLogId(jobLogId);
        entity.setJobMessage(message);
        entity.setStatus(Constants.FAIL);
        entity.setExceptionInfo(exceptionInfo);
        entity.setDurationMs(durationMs);
        entity.setEndTime(new Date());
        sysJobLogMapper.updateById(entity);
    }

    @Override
    public boolean deleteByIds(Long[] jobLogIds) {
        return sysJobLogMapper.deleteByIds(Arrays.asList(jobLogIds)) > 0;
    }

    @Override
    public void clean() {
        sysJobLogMapper.delete(new LambdaQueryWrapper<>());
    }

    private LambdaQueryWrapper<SysJobLog> buildQueryWrapper(SysJobLogBo bo) {
        Map<String, Object> params = bo.getParams();
        return new LambdaQueryWrapper<SysJobLog>()
            .eq(bo.getJobId() != null, SysJobLog::getJobId, bo.getJobId())
            .like(StringUtils.isNotBlank(bo.getJobName()), SysJobLog::getJobName, bo.getJobName())
            .eq(StringUtils.isNotBlank(bo.getJobGroup()), SysJobLog::getJobGroup, bo.getJobGroup())
            .eq(StringUtils.isNotBlank(bo.getHandlerKey()), SysJobLog::getHandlerKey, bo.getHandlerKey())
            .eq(StringUtils.isNotBlank(bo.getTriggerSource()), SysJobLog::getTriggerSource, bo.getTriggerSource())
            .eq(StringUtils.isNotBlank(bo.getStatus()), SysJobLog::getStatus, bo.getStatus())
            .between(params.get("beginTime") != null && params.get("endTime") != null,
                SysJobLog::getStartTime, params.get("beginTime"), params.get("endTime"));
    }
}
