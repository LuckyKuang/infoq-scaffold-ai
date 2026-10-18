package cc.infoq.system.service.impl;

import cc.infoq.system.config.MessageCleanupProperties;
import cc.infoq.system.service.SysMessageService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.mockito.Mockito.*;

@Tag("dev")
class SysMessageCleanupTaskHandlerTest {

    @Test
    @DisplayName("execute: should keep all history when cleanup is disabled")
    void executeShouldSkipWhenDisabled() {
        MessageCleanupProperties properties = new MessageCleanupProperties();
        SysMessageService service = mock(SysMessageService.class);

        new SysMessageCleanupTaskHandler(properties, service).execute(Map.of());

        verifyNoInteractions(service);
    }

    @Test
    @DisplayName("execute: should delegate configured retention when enabled")
    void executeShouldDelegateConfiguredRetentionWhenEnabled() {
        MessageCleanupProperties properties = new MessageCleanupProperties();
        properties.setEnabled(true);
        properties.setSoftDeleteRetentionDays(45);
        SysMessageService service = mock(SysMessageService.class);
        when(service.cleanupDeletedRecipients(45)).thenReturn(new SysMessageService.MessageCleanupResult(2, 1));

        new SysMessageCleanupTaskHandler(properties, service).execute(Map.of());

        verify(service).cleanupDeletedRecipients(45);
    }
}
