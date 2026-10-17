package cc.infoq.system.service.impl;

import cc.infoq.common.constant.SystemConstants;
import cc.infoq.common.exception.ServiceException;
import cc.infoq.common.json.utils.JsonUtils;
import cc.infoq.common.mybatis.core.page.PageQuery;
import cc.infoq.common.mybatis.core.page.TableDataInfo;
import cc.infoq.common.mybatis.utils.IdGeneratorUtil;
import cc.infoq.common.quartz.core.*;
import cc.infoq.common.utils.StringUtils;
import cc.infoq.system.domain.bo.SysJobBo;
import cc.infoq.system.domain.entity.SysJob;
import cc.infoq.system.domain.vo.SysJobVo;
import cc.infoq.system.mapper.SysJobMapper;
import cc.infoq.system.service.SysJobLogService;
import cc.infoq.system.service.SysJobService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.core.type.TypeReference;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.quartz.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 定时任务 Service 实现
 *
 * @author Pontus
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "infoq.quartz", name = "enabled", havingValue = "true", matchIfMissing = true)
public class SysJobServiceImpl implements SysJobService, ManagedQuartzJobExecutor {

    public static final String TRIGGER_SOURCE_SCHEDULE = "schedule";
    public static final String TRIGGER_SOURCE_MANUAL = "manual";

    private static final String MISFIRE_DEFAULT = "0";
    private static final String MISFIRE_IGNORE = "1";
    private static final String MISFIRE_FIRE_AND_PROCEED = "2";
    private static final String MISFIRE_DO_NOTHING = "3";

    private final SysJobMapper sysJobMapper;
    private final SysJobLogService sysJobLogService;
    private final ManagedQuartzTaskDispatcher taskDispatcher;
    private final ManagedQuartzKeyBuilder keyBuilder;
    private final Scheduler scheduler;

    @Override
    public TableDataInfo<SysJobVo> queryPageList(SysJobBo bo, PageQuery pageQuery) {
        LambdaQueryWrapper<SysJob> lqw = buildQueryWrapper(bo);
        if (StringUtils.isBlank(pageQuery.getOrderByColumn())) {
            lqw.orderByDesc(SysJob::getJobId);
        }
        Page<SysJobVo> page = sysJobMapper.selectVoPage(pageQuery.build(), lqw);
        return TableDataInfo.build(page);
    }

    @Override
    public List<SysJobVo> queryList(SysJobBo bo) {
        return sysJobMapper.selectVoList(buildQueryWrapper(bo).orderByDesc(SysJob::getJobId));
    }

    @Override
    public SysJobVo queryById(Long jobId) {
        return sysJobMapper.selectVoById(jobId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean insertByBo(SysJobBo bo) {
        validateJobBo(bo);
        SysJob entity = toEntity(bo);
        boolean saved = sysJobMapper.insert(entity) > 0;
        if (!saved) {
            return false;
        }
        bo.setJobId(entity.getJobId());
        createOrReplaceSchedule(entity);
        return true;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean updateByBo(SysJobBo bo) {
        validateJobBo(bo);
        SysJob existing = requiredEntity(bo.getJobId());
        boolean updated = sysJobMapper.updateById(toEntity(bo)) > 0;
        if (!updated) {
            return false;
        }
        deleteQuartzJob(existing.getJobId(), existing.getJobGroup());
        createOrReplaceSchedule(requiredEntity(bo.getJobId()));
        return true;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean deleteByIds(Long[] jobIds) {
        boolean deleted = false;
        for (Long jobId : jobIds) {
            SysJob entity = requiredEntity(jobId);
            deleted = sysJobMapper.deleteById(jobId) > 0 || deleted;
            deleteQuartzJob(entity.getJobId(), entity.getJobGroup());
        }
        return deleted;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean changeStatus(SysJobBo bo) {
        SysJob entity = requiredEntity(bo.getJobId());
        String targetStatus = bo.getStatus();
        if (!SystemConstants.NORMAL.equals(targetStatus) && !SystemConstants.DISABLE.equals(targetStatus)) {
            throw new ServiceException("不支持的任务状态: {}", targetStatus);
        }
        if (StringUtils.equals(entity.getStatus(), targetStatus)) {
            throw new ServiceException("任务状态未变化，无需重复操作");
        }
        entity.setStatus(targetStatus);
        boolean updated = sysJobMapper.updateById(entity) > 0;
        if (!updated) {
            return false;
        }
        JobKey jobKey = keyBuilder.jobKey(entity.getJobId(), entity.getJobGroup());
        try {
            if (SystemConstants.NORMAL.equals(targetStatus)) {
                scheduler.resumeJob(jobKey);
            } else {
                scheduler.pauseJob(jobKey);
            }
        } catch (SchedulerException e) {
            throw new ServiceException("同步Quartz任务状态失败: {}", e.getMessage());
        }
        return true;
    }

    @Override
    public boolean runNow(Long jobId) {
        SysJob entity = requiredEntity(jobId);
        JobKey jobKey = keyBuilder.jobKey(entity.getJobId(), entity.getJobGroup());
        try {
            if (!scheduler.checkExists(jobKey)) {
                throw new ServiceException("任务不存在或尚未同步到Quartz");
            }
            JobDataMap dataMap = new JobDataMap();
            ManagedQuartzTaskPayload payload = new ManagedQuartzTaskPayload();
            payload.setJobId(entity.getJobId());
            payload.setTriggerSource(TRIGGER_SOURCE_MANUAL);
            dataMap.put(ManagedQuartzJob.PAYLOAD_KEY, payload);
            scheduler.triggerJob(jobKey, dataMap);
            return true;
        } catch (SchedulerException e) {
            throw new ServiceException("立即执行任务失败: {}", e.getMessage());
        }
    }

    @Override
    public List<String> listHandlerKeys() {
        Set<String> keys = taskDispatcher.supportedHandlerKeys();
        return keys.stream().sorted().toList();
    }

    @Override
    public void init() {
        List<SysJob> jobs = sysJobMapper.selectList(new LambdaQueryWrapper<SysJob>().orderByAsc(SysJob::getJobId));
        jobs.forEach(this::safeReconcileSchedule);
        log.info("托管定时任务恢复完成, count={}", jobs.size());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void execute(ManagedQuartzTaskPayload payload) {
        SysJob entity = requiredEntity(payload.getJobId());
        long startNanos = System.nanoTime();
        long jobLogId = IdGeneratorUtil.nextLongId();
        sysJobLogService.recordStart(jobLogId, entity.getJobId(), entity.getJobName(), entity.getJobGroup(),
            entity.getHandlerKey(), entity.getHandlerParams(), payload.getTriggerSource());

        try {
            taskDispatcher.dispatch(entity.getHandlerKey(), parseHandlerParams(entity.getHandlerParams()));
            sysJobLogService.recordSuccess(jobLogId, "任务执行成功", elapsedMillis(startNanos));
        } catch (Exception e) {
            sysJobLogService.recordFailure(jobLogId, "任务执行失败", buildStackTrace(e), elapsedMillis(startNanos));
            throw e;
        }
    }

    private void safeReconcileSchedule(SysJob entity) {
        try {
            deleteQuartzJob(entity.getJobId(), entity.getJobGroup());
            createOrReplaceSchedule(entity);
        } catch (Exception e) {
            throw new ServiceException("恢复托管定时任务失败, jobId={}, message={}", entity.getJobId(), e.getMessage());
        }
    }

    private void createOrReplaceSchedule(SysJob entity) {
        validateJobEntity(entity);
        try {
            JobKey jobKey = keyBuilder.jobKey(entity.getJobId(), entity.getJobGroup());
            TriggerKey triggerKey = keyBuilder.triggerKey(entity.getJobId(), entity.getJobGroup());
            JobDetail jobDetail = JobBuilder.newJob(resolveJobClass(entity)).withIdentity(jobKey).build();

            ManagedQuartzTaskPayload payload = new ManagedQuartzTaskPayload();
            payload.setJobId(entity.getJobId());
            payload.setTriggerSource(TRIGGER_SOURCE_SCHEDULE);
            jobDetail.getJobDataMap().put(ManagedQuartzJob.PAYLOAD_KEY, payload);

            CronScheduleBuilder scheduleBuilder = buildCronSchedule(entity);
            CronTrigger trigger = TriggerBuilder.newTrigger()
                .withIdentity(triggerKey)
                .withSchedule(scheduleBuilder)
                .forJob(jobDetail)
                .build();

            scheduler.scheduleJob(jobDetail, trigger);
            if (SystemConstants.DISABLE.equals(entity.getStatus())) {
                scheduler.pauseJob(jobKey);
            }
        } catch (SchedulerException e) {
            throw new ServiceException("创建Quartz任务失败: {}", e.getMessage());
        }
    }

    private void deleteQuartzJob(Long jobId, String jobGroup) {
        try {
            JobKey jobKey = keyBuilder.jobKey(jobId, jobGroup);
            if (scheduler.checkExists(jobKey)) {
                scheduler.deleteJob(jobKey);
            }
        } catch (SchedulerException e) {
            throw new ServiceException("清理Quartz任务失败: {}", e.getMessage());
        }
    }

    private void validateJobBo(SysJobBo bo) {
        if (StringUtils.isBlank(bo.getCronExpression()) || !CronExpressionValidator.isValid(bo.getCronExpression())) {
            throw new ServiceException("Cron表达式不合法");
        }
        if (!taskDispatcher.supports(bo.getHandlerKey())) {
            throw new ServiceException("未注册的处理器标识: {}", bo.getHandlerKey());
        }
        parseHandlerParams(bo.getHandlerParams());
    }

    private void validateJobEntity(SysJob entity) {
        if (!taskDispatcher.supports(entity.getHandlerKey())) {
            throw new ServiceException("任务引用了未注册的处理器: {}", entity.getHandlerKey());
        }
        parseHandlerParams(entity.getHandlerParams());
    }

    private LambdaQueryWrapper<SysJob> buildQueryWrapper(SysJobBo bo) {
        return new LambdaQueryWrapper<SysJob>()
            .like(StringUtils.isNotBlank(bo.getJobName()), SysJob::getJobName, bo.getJobName())
            .eq(StringUtils.isNotBlank(bo.getJobGroup()), SysJob::getJobGroup, bo.getJobGroup())
            .eq(StringUtils.isNotBlank(bo.getStatus()), SysJob::getStatus, bo.getStatus())
            .eq(StringUtils.isNotBlank(bo.getHandlerKey()), SysJob::getHandlerKey, bo.getHandlerKey());
    }

    private SysJob requiredEntity(Long jobId) {
        SysJob entity = sysJobMapper.selectById(jobId);
        if (entity == null) {
            throw new ServiceException("任务不存在: {}", jobId);
        }
        return entity;
    }

    private SysJob toEntity(SysJobBo bo) {
        SysJob entity = new SysJob();
        entity.setJobId(bo.getJobId());
        entity.setJobName(bo.getJobName());
        entity.setJobGroup(bo.getJobGroup());
        entity.setHandlerKey(bo.getHandlerKey());
        entity.setHandlerParams(normalizeHandlerParams(bo.getHandlerParams()));
        entity.setCronExpression(bo.getCronExpression());
        entity.setMisfirePolicy(bo.getMisfirePolicy());
        entity.setConcurrent(bo.getConcurrent());
        entity.setStatus(bo.getStatus());
        entity.setRemark(bo.getRemark());
        return entity;
    }

    private CronScheduleBuilder buildCronSchedule(SysJob entity) {
        CronScheduleBuilder builder = CronScheduleBuilder.cronSchedule(entity.getCronExpression());
        return switch (entity.getMisfirePolicy()) {
            case MISFIRE_DEFAULT -> builder;
            case MISFIRE_IGNORE -> builder.withMisfireHandlingInstructionIgnoreMisfires();
            case MISFIRE_FIRE_AND_PROCEED -> builder.withMisfireHandlingInstructionFireAndProceed();
            case MISFIRE_DO_NOTHING -> builder.withMisfireHandlingInstructionDoNothing();
            default -> throw new ServiceException("不支持的错过策略: {}", entity.getMisfirePolicy());
        };
    }

    private Map<String, Object> parseHandlerParams(String handlerParams) {
        if (StringUtils.isBlank(handlerParams)) {
            return Collections.emptyMap();
        }
        try {
            return JsonUtils.parseObject(handlerParams, new TypeReference<Map<String, Object>>() {});
        } catch (RuntimeException e) {
            throw new ServiceException("处理器参数必须为JSON对象");
        }
    }

    private String normalizeHandlerParams(String handlerParams) {
        if (StringUtils.isBlank(handlerParams)) {
            return "{}";
        }
        Map<String, Object> params = parseHandlerParams(handlerParams);
        return JsonUtils.toJsonString(params);
    }

    private long elapsedMillis(long startNanos) {
        return (System.nanoTime() - startNanos) / 1_000_000L;
    }

    private String buildStackTrace(Exception e) {
        StringWriter writer = new StringWriter();
        e.printStackTrace(new PrintWriter(writer));
        return StringUtils.substring(writer.toString(), 0, 4000);
    }

    private Class<? extends Job> resolveJobClass(SysJob entity) {
        if (SystemConstants.NORMAL.equals(entity.getConcurrent())) {
            return ManagedQuartzConcurrentJob.class;
        }
        if (SystemConstants.DISABLE.equals(entity.getConcurrent())) {
            return ManagedQuartzDisallowConcurrentJob.class;
        }
        throw new ServiceException("不支持的并发策略: {}", entity.getConcurrent());
    }

    private static final class CronExpressionValidator {
        private static boolean isValid(String cronExpression) {
            return org.quartz.CronExpression.isValidExpression(cronExpression);
        }
    }
}
