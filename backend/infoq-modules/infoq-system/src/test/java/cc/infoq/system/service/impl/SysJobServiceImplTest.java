package cc.infoq.system.service.impl;

import cc.infoq.common.constant.SystemConstants;
import cc.infoq.common.exception.ServiceException;
import cc.infoq.common.utils.SpringUtils;
import cc.infoq.common.quartz.core.ManagedQuartzKeyBuilder;
import cc.infoq.common.quartz.core.ManagedQuartzTaskDispatcher;
import cc.infoq.common.quartz.core.ManagedQuartzTaskPayload;
import cc.infoq.system.domain.entity.SysJob;
import cc.infoq.system.mapper.SysJobMapper;
import cc.infoq.system.service.SysJobLogService;
import com.baomidou.mybatisplus.core.incrementer.IdentifierGenerator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.ArgumentCaptor;
import org.mockito.junit.jupiter.MockitoExtension;
import org.quartz.Scheduler;
import org.springframework.context.support.GenericApplicationContext;
import org.springframework.transaction.annotation.Transactional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@Tag("dev")
class SysJobServiceImplTest {

    @Mock
    private SysJobMapper sysJobMapper;
    @Mock
    private SysJobLogService sysJobLogService;
    @Mock
    private ManagedQuartzTaskDispatcher taskDispatcher;
    @Mock
    private ManagedQuartzKeyBuilder keyBuilder;
    @Mock
    private Scheduler scheduler;

    @BeforeEach
    void initSpringContext() {
        // IdGeneratorUtil 在类初始化时从 Spring 容器取 IdentifierGenerator
        GenericApplicationContext context = new GenericApplicationContext();
        context.registerBean(IdentifierGenerator.class, () -> entity -> 99L);
        context.refresh();
        new SpringUtils().setApplicationContext(context);
    }

    @Test
    @DisplayName("execute: must not run inside a transaction so failure logs survive the rethrown exception")
    void executeMustNotBeTransactional() throws Exception {
        assertNull(SysJobServiceImpl.class
            .getMethod("execute", ManagedQuartzTaskPayload.class)
            .getAnnotation(Transactional.class));
    }

    @Test
    @DisplayName("execute: should record start then failure and rethrow when handler fails")
    void executeShouldRecordFailureAndRethrow() {
        SysJobServiceImpl service = newService();
        when(sysJobMapper.selectById(7L)).thenReturn(job());
        doThrow(new ServiceException("boom")).when(taskDispatcher).dispatch(eq("system.demo"), anyMap());

        assertThrows(ServiceException.class, () -> service.execute(payload()));

        ArgumentCaptor<Long> jobLogId = ArgumentCaptor.forClass(Long.class);
        InOrder order = inOrder(sysJobLogService);
        order.verify(sysJobLogService).recordStart(jobLogId.capture(), eq(7L), eq("demo"), eq("DEFAULT"), eq("system.demo"), any(), eq("schedule"));
        order.verify(sysJobLogService).recordFailure(eq(jobLogId.getValue()), eq("任务执行失败"), contains("boom"), anyLong());
        verify(sysJobLogService, never()).recordSuccess(anyLong(), anyString(), anyLong());
    }

    @Test
    @DisplayName("execute: should record success when handler completes")
    void executeShouldRecordSuccess() {
        SysJobServiceImpl service = newService();
        when(sysJobMapper.selectById(7L)).thenReturn(job());

        service.execute(payload());

        verify(sysJobLogService).recordStart(anyLong(), eq(7L), eq("demo"), eq("DEFAULT"), eq("system.demo"), any(), eq("schedule"));
        verify(sysJobLogService).recordSuccess(anyLong(), eq("任务执行成功"), anyLong());
        verify(sysJobLogService, never()).recordFailure(anyLong(), anyString(), anyString(), anyLong());
    }

    private SysJobServiceImpl newService() {
        return new SysJobServiceImpl(sysJobMapper, sysJobLogService, taskDispatcher, keyBuilder, scheduler);
    }

    private ManagedQuartzTaskPayload payload() {
        ManagedQuartzTaskPayload payload = new ManagedQuartzTaskPayload();
        payload.setJobId(7L);
        payload.setTriggerSource(SysJobServiceImpl.TRIGGER_SOURCE_SCHEDULE);
        return payload;
    }

    private SysJob job() {
        SysJob job = new SysJob();
        job.setJobId(7L);
        job.setJobName("demo");
        job.setJobGroup("DEFAULT");
        job.setHandlerKey("system.demo");
        job.setStatus(SystemConstants.NORMAL);
        return job;
    }
}
