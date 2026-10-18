package cc.infoq.system.service.impl;

import cc.infoq.system.domain.entity.SysMessage;
import cc.infoq.system.domain.entity.SysMessageRecipient;
import cc.infoq.system.domain.entity.SysUser;
import cc.infoq.system.event.SystemMessageCommittedEvent;
import cc.infoq.system.mapper.SysMessageMapper;
import cc.infoq.system.mapper.SysMessageRecipientMapper;
import cc.infoq.system.mapper.SysUserMapper;
import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import org.apache.ibatis.builder.MapperBuilderAssistant;
import org.apache.ibatis.session.Configuration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@Tag("dev")
class SysMessageServiceImplTest {

    @Mock
    private SysMessageMapper messageMapper;
    @Mock
    private SysMessageRecipientMapper recipientMapper;
    @Mock
    private SysUserMapper userMapper;
    @Mock
    private ApplicationEventPublisher eventPublisher;

    @BeforeEach
    void setUp() {
        initializeTableInfo(SysUser.class);
        initializeTableInfo(SysMessageRecipient.class);
    }

    @Test
    @DisplayName("publishSystemNotice: should create recipients in one batch and emit a committed event")
    void publishSystemNoticeShouldBatchRecipientsAndEmitEvent() {
        SysMessageServiceImpl service = service();
        SysUser first = new SysUser();
        first.setUserId(10L);
        SysUser second = new SysUser();
        second.setUserId(20L);
        when(userMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(first, second));
        doAnswer(invocation -> {
            ((SysMessage) invocation.getArgument(0)).setMessageId(99L);
            return 1;
        }).when(messageMapper).insert(any(SysMessage.class));
        when(recipientMapper.insertBatch(anyList())).thenReturn(true);

        service.publishSystemNotice("发布", "内容", "1", "notice:99");

        ArgumentCaptor<List<SysMessageRecipient>> recipients = ArgumentCaptor.forClass(List.class);
        verify(recipientMapper).insertBatch(recipients.capture());
        assertEquals(List.of(10L, 20L), recipients.getValue().stream().map(SysMessageRecipient::getUserId).toList());
        assertEquals(List.of(99L, 99L), recipients.getValue().stream().map(SysMessageRecipient::getMessageId).toList());
        ArgumentCaptor<SystemMessageCommittedEvent> event = ArgumentCaptor.forClass(SystemMessageCommittedEvent.class);
        verify(eventPublisher).publishEvent(event.capture());
        assertEquals("message-99", event.getValue().correlationId());
        assertEquals(99L, event.getValue().messageId());
        assertEquals(List.of(10L, 20L), event.getValue().recipientUserIds());
    }

    @Test
    @DisplayName("current user message mutations: should always constrain writes by the current user")
    void currentUserMutationsShouldConstrainWritesByCurrentUser() {
        SysMessageServiceImpl service = service();
        when(recipientMapper.selectCount(any(LambdaQueryWrapper.class))).thenReturn(3L);

        assertEquals(3L, service.countUnread(10L));
        service.markRead(10L, 99L);
        service.markAllRead(10L);
        service.deleteByMessageIds(10L, new Long[]{99L, 100L});

        ArgumentCaptor<LambdaQueryWrapper<SysMessageRecipient>> countWrapper = ArgumentCaptor.forClass(LambdaQueryWrapper.class);
        verify(recipientMapper).selectCount(countWrapper.capture());
        countWrapper.getValue().getSqlSegment();
        assertTrue(countWrapper.getValue().getParamNameValuePairs().containsValue(10L));

        ArgumentCaptor<Wrapper<SysMessageRecipient>> updateWrapper = ArgumentCaptor.forClass(Wrapper.class);
        verify(recipientMapper, org.mockito.Mockito.times(3)).update(isNull(), updateWrapper.capture());
        updateWrapper.getAllValues().forEach(wrapper -> {
            assertTrue(wrapper instanceof LambdaUpdateWrapper<?>);
            LambdaUpdateWrapper<?> lambdaWrapper = (LambdaUpdateWrapper<?>) wrapper;
            lambdaWrapper.getSqlSegment();
            assertTrue(lambdaWrapper.getParamNameValuePairs().containsValue(10L));
        });
    }

    @Test
    @DisplayName("cleanupDeletedRecipients: should remove only retained soft deletes before expired message shells")
    void cleanupDeletedRecipientsShouldRemoveRetainedDataInOrder() {
        SysMessageServiceImpl service = service();
        when(recipientMapper.delete(any(LambdaQueryWrapper.class))).thenReturn(4);
        when(messageMapper.deleteExpiredWithoutRecipients(any())).thenReturn(2);

        var result = service.cleanupDeletedRecipients(30);

        assertEquals(4, result.deletedRecipients());
        assertEquals(2, result.deletedMessages());
        verify(recipientMapper).delete(any(LambdaQueryWrapper.class));
        verify(messageMapper).deleteExpiredWithoutRecipients(any());
    }

    private SysMessageServiceImpl service() {
        return new SysMessageServiceImpl(messageMapper, recipientMapper, userMapper, eventPublisher);
    }

    private void initializeTableInfo(Class<?> entityType) {
        if (TableInfoHelper.getTableInfo(entityType) == null) {
            TableInfoHelper.initTableInfo(new MapperBuilderAssistant(new Configuration(), ""), entityType);
        }
    }
}
