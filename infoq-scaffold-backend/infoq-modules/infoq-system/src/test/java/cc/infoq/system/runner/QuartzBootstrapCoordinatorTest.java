package cc.infoq.system.runner;

import cc.infoq.common.quartz.properties.QuartzManagedProperties;
import com.baomidou.lock.LockInfo;
import com.baomidou.lock.LockTemplate;
import com.baomidou.lock.executor.LockExecutor;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@Tag("dev")
class QuartzBootstrapCoordinatorTest {

    @Mock
    private LockTemplate lockTemplate;
    @Mock
    private Environment environment;
    @Mock
    private QuartzBootstrapMarkerStore markerStore;

    @Test
    @DisplayName("reconcile: should skip when reconcile is disabled")
    void reconcileShouldSkipWhenDisabled() {
        QuartzManagedProperties properties = properties(false, false, false);
        QuartzBootstrapCoordinator coordinator = new QuartzBootstrapCoordinator(properties, lockTemplate, environment, markerStore);
        Runnable runnable = mock(Runnable.class);

        boolean executed = coordinator.reconcile(runnable);

        assertFalse(executed);
        verify(runnable, never()).run();
        verify(lockTemplate, never()).lock(eq("infoq:quartz:bootstrap-reconcile:default"), anyLong(), anyLong());
    }

    @Test
    @DisplayName("reconcile: should run directly when production guard is disabled")
    void reconcileShouldRunDirectlyWhenProductionGuardDisabled() {
        QuartzManagedProperties properties = properties(true, false, false);
        QuartzBootstrapCoordinator coordinator = new QuartzBootstrapCoordinator(properties, lockTemplate, environment, markerStore);
        Runnable runnable = mock(Runnable.class);

        boolean executed = coordinator.reconcile(runnable);

        assertTrue(executed);
        verify(runnable).run();
        verify(lockTemplate, never()).lock(eq("infoq:quartz:bootstrap-reconcile:default"), anyLong(), anyLong());
    }

    @Test
    @DisplayName("reconcile: should run directly in non-prod even when guard is enabled")
    void reconcileShouldRunDirectlyOutsideProd() {
        QuartzManagedProperties properties = properties(true, true, true);
        QuartzBootstrapCoordinator coordinator = new QuartzBootstrapCoordinator(properties, lockTemplate, environment, markerStore);
        Runnable runnable = mock(Runnable.class);
        when(environment.acceptsProfiles(Profiles.of("prod"))).thenReturn(false);

        boolean executed = coordinator.reconcile(runnable);

        assertTrue(executed);
        verify(runnable).run();
        verify(lockTemplate, never()).lock(eq("infoq:quartz:bootstrap-reconcile:default"), anyLong(), anyLong());
    }

    @Test
    @DisplayName("reconcile: should skip when prod guard lock is not acquired")
    void reconcileShouldSkipWhenLockNotAcquired() {
        QuartzManagedProperties properties = properties(true, true, true);
        QuartzBootstrapCoordinator coordinator = new QuartzBootstrapCoordinator(properties, lockTemplate, environment, markerStore);
        Runnable runnable = mock(Runnable.class);
        when(environment.acceptsProfiles(Profiles.of("prod"))).thenReturn(true);
        when(lockTemplate.lock("infoq:quartz:bootstrap-reconcile:prod", -1L, 3000L)).thenReturn(null);

        boolean executed = coordinator.reconcile(runnable);

        assertFalse(executed);
        verify(runnable, never()).run();
    }

    @Test
    @DisplayName("reconcile: should skip when marker already exists in prod")
    void reconcileShouldSkipWhenMarkerExists() {
        QuartzManagedProperties properties = properties(true, true, true);
        QuartzBootstrapCoordinator coordinator = new QuartzBootstrapCoordinator(properties, lockTemplate, environment, markerStore);
        Runnable runnable = mock(Runnable.class);
        LockInfo lockInfo = new LockInfo("k", "v", -1L, 3000L, 1, new Object(), mock(LockExecutor.class));
        when(environment.acceptsProfiles(Profiles.of("prod"))).thenReturn(true);
        when(lockTemplate.lock("infoq:quartz:bootstrap-reconcile:prod", -1L, 3000L)).thenReturn(lockInfo);
        when(markerStore.hasMarker("infoq:quartz:bootstrap:applied:prod:2.1.8-20260602120000")).thenReturn(true);

        boolean executed = coordinator.reconcile(runnable);

        assertFalse(executed);
        verify(runnable, never()).run();
        verify(lockTemplate).releaseLock(lockInfo);
        verify(markerStore).hasMarker("infoq:quartz:bootstrap:applied:prod:2.1.8-20260602120000");
        verify(markerStore, never()).markApplied("infoq:quartz:bootstrap:applied:prod:2.1.8-20260602120000");
    }

    @Test
    @DisplayName("reconcile: should run and write marker when prod guard lock is acquired")
    void reconcileShouldRunAndWriteMarkerWhenGuarded() {
        QuartzManagedProperties properties = properties(true, true, true);
        QuartzBootstrapCoordinator coordinator = new QuartzBootstrapCoordinator(properties, lockTemplate, environment, markerStore);
        Runnable runnable = mock(Runnable.class);
        LockInfo lockInfo = new LockInfo("k", "v", -1L, 3000L, 1, new Object(), mock(LockExecutor.class));
        when(environment.acceptsProfiles(Profiles.of("prod"))).thenReturn(true);
        when(lockTemplate.lock("infoq:quartz:bootstrap-reconcile:prod", -1L, 3000L)).thenReturn(lockInfo);
        when(markerStore.hasMarker("infoq:quartz:bootstrap:applied:prod:2.1.8-20260602120000")).thenReturn(false);

        boolean executed = coordinator.reconcile(runnable);

        assertTrue(executed);
        verify(runnable).run();
        verify(lockTemplate).releaseLock(lockInfo);
        verify(markerStore).hasMarker("infoq:quartz:bootstrap:applied:prod:2.1.8-20260602120000");
        verify(markerStore).markApplied("infoq:quartz:bootstrap:applied:prod:2.1.8-20260602120000");
    }

    @Test
    @DisplayName("reconcile: should use new deployId as a distinct prod marker")
    void reconcileShouldUseNewDeployIdAsDistinctMarker() {
        QuartzManagedProperties properties = properties(true, true, true);
        properties.getBootstrap().setDeployId("2.1.8-20260602123000");
        QuartzBootstrapCoordinator coordinator = new QuartzBootstrapCoordinator(properties, lockTemplate, environment, markerStore);
        Runnable runnable = mock(Runnable.class);
        LockInfo lockInfo = new LockInfo("k", "v", -1L, 3000L, 1, new Object(), mock(LockExecutor.class));
        when(environment.acceptsProfiles(Profiles.of("prod"))).thenReturn(true);
        when(lockTemplate.lock("infoq:quartz:bootstrap-reconcile:prod", -1L, 3000L)).thenReturn(lockInfo);
        when(markerStore.hasMarker("infoq:quartz:bootstrap:applied:prod:2.1.8-20260602123000")).thenReturn(false);

        boolean executed = coordinator.reconcile(runnable);

        assertTrue(executed);
        verify(runnable).run();
        verify(markerStore).hasMarker("infoq:quartz:bootstrap:applied:prod:2.1.8-20260602123000");
        verify(markerStore).markApplied("infoq:quartz:bootstrap:applied:prod:2.1.8-20260602123000");
        verify(lockTemplate).releaseLock(lockInfo);
    }

    @Test
    @DisplayName("reconcile: should fail fast when deployId is missing in prod")
    void reconcileShouldFailWhenDeployIdMissingInProd() {
        QuartzManagedProperties properties = properties(true, true, true);
        properties.getBootstrap().setDeployId("   ");
        QuartzBootstrapCoordinator coordinator = new QuartzBootstrapCoordinator(properties, lockTemplate, environment, markerStore);
        Runnable runnable = mock(Runnable.class);
        when(environment.acceptsProfiles(Profiles.of("prod"))).thenReturn(true);

        IllegalStateException exception = assertThrows(IllegalStateException.class, () -> coordinator.reconcile(runnable));

        assertEquals("生产环境 Quartz bootstrap reconcile 必须提供 deployId", exception.getMessage());
        verify(runnable, never()).run();
        verify(lockTemplate, never()).lock(eq("infoq:quartz:bootstrap-reconcile:prod"), anyLong(), anyLong());
    }

    @Test
    @DisplayName("reconcile: should fail fast when marker is disabled in prod")
    void reconcileShouldFailWhenMarkerDisabledInProd() {
        QuartzManagedProperties properties = properties(true, true, false);
        QuartzBootstrapCoordinator coordinator = new QuartzBootstrapCoordinator(properties, lockTemplate, environment, markerStore);
        Runnable runnable = mock(Runnable.class);
        when(environment.acceptsProfiles(Profiles.of("prod"))).thenReturn(true);

        IllegalStateException exception = assertThrows(IllegalStateException.class, () -> coordinator.reconcile(runnable));

        assertEquals("生产环境 Quartz bootstrap reconcile 必须启用 markerEnabled", exception.getMessage());
        verify(runnable, never()).run();
        verify(lockTemplate, never()).lock(eq("infoq:quartz:bootstrap-reconcile:prod"), anyLong(), anyLong());
    }

    @Test
    @DisplayName("markerKey/lockKey: should include prod profile and deployId")
    void markerKeyAndLockKeyShouldIncludeProfile() {
        QuartzManagedProperties properties = properties(true, true, true);
        QuartzBootstrapCoordinator coordinator = new QuartzBootstrapCoordinator(properties, lockTemplate, environment, markerStore);
        when(environment.acceptsProfiles(Profiles.of("prod"))).thenReturn(true);

        assertEquals("infoq:quartz:bootstrap:applied:prod:2.1.8-20260602120000", coordinator.markerKey());
        assertEquals("infoq:quartz:bootstrap-reconcile:prod", coordinator.lockKey());
    }

    @Test
    @DisplayName("markerKey/lockKey: should stay on prod segment when multiple profiles are active")
    void markerKeyAndLockKeyShouldPreferProdSegment() {
        QuartzManagedProperties properties = properties(true, true, true);
        QuartzBootstrapCoordinator coordinator = new QuartzBootstrapCoordinator(properties, lockTemplate, environment, markerStore);
        when(environment.acceptsProfiles(Profiles.of("prod"))).thenReturn(true);

        assertEquals("infoq:quartz:bootstrap:applied:prod:2.1.8-20260602120000", coordinator.markerKey());
        assertEquals("infoq:quartz:bootstrap-reconcile:prod", coordinator.lockKey());
    }

    @Test
    @DisplayName("isProdProfileActive: should delegate to environment")
    void isProdProfileActiveShouldDelegate() {
        QuartzManagedProperties properties = properties(true, true, true);
        QuartzBootstrapCoordinator coordinator = new QuartzBootstrapCoordinator(properties, lockTemplate, environment, markerStore);
        when(environment.acceptsProfiles(Profiles.of("prod"))).thenReturn(true, false);

        assertTrue(coordinator.isProdProfileActive());
        assertFalse(coordinator.isProdProfileActive());
    }

    private static QuartzManagedProperties properties(boolean reconcileEnabled, boolean productionGuardEnabled, boolean markerEnabled) {
        QuartzManagedProperties properties = new QuartzManagedProperties();
        properties.getBootstrap().setReconcileEnabled(reconcileEnabled);
        properties.getBootstrap().setProductionGuardEnabled(productionGuardEnabled);
        properties.getBootstrap().setMarkerEnabled(markerEnabled);
        properties.getBootstrap().setMarkerPrefix("infoq:quartz:bootstrap:applied");
        properties.getBootstrap().setDeployId("2.1.8-20260602120000");
        properties.getBootstrap().setLockKey("infoq:quartz:bootstrap-reconcile");
        properties.getBootstrap().setLockAcquireTimeout(3000L);
        properties.getBootstrap().setLockExpire(-1L);
        return properties;
    }
}
