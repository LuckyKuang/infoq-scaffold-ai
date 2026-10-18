package cc.infoq.system.runner;

import cc.infoq.common.quartz.properties.QuartzManagedProperties;
import com.baomidou.lock.LockInfo;
import com.baomidou.lock.LockTemplate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.Objects;

/**
 * 协调 Quartz 启动期 reconcile 行为，按环境控制开关、互斥与部署级 marker。
 *
 * @author Pontus
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class QuartzBootstrapCoordinator {

    static final String PROD_PROFILE = "prod";

    private final QuartzManagedProperties quartzManagedProperties;
    private final LockTemplate lockTemplate;
    private final Environment environment;
    private final QuartzBootstrapMarkerStore markerStore;

    public boolean reconcile(Runnable task) {
        QuartzManagedProperties.Bootstrap bootstrap = quartzManagedProperties.getBootstrap();
        if (!bootstrap.isReconcileEnabled()) {
            log.info("跳过 Quartz bootstrap reconcile: reconcileEnabled=false");
            return false;
        }

        if (!bootstrap.isProductionGuardEnabled() || !isProdProfileActive()) {
            task.run();
            return true;
        }

        validateProdBootstrap(bootstrap);

        LockInfo lockInfo = lockTemplate.lock(
            lockKey(),
            bootstrap.getLockExpire(),
            bootstrap.getLockAcquireTimeout()
        );
        if (lockInfo == null) {
            log.info("跳过 Quartz bootstrap reconcile: lock not acquired, lockKey={}", lockKey());
            return false;
        }

        try {
            String markerKey = markerKey();
            if (bootstrap.isMarkerEnabled() && markerStore.hasMarker(markerKey)) {
                log.info("跳过 Quartz bootstrap reconcile: marker exists, markerKey={}", markerKey);
                return false;
            }
            task.run();
            if (bootstrap.isMarkerEnabled()) {
                markerStore.markApplied(markerKey);
                log.info("写入 Quartz bootstrap marker 成功, markerKey={}", markerKey);
            }
            return true;
        } finally {
            lockTemplate.releaseLock(lockInfo);
        }
    }

    boolean isProdProfileActive() {
        return environment.acceptsProfiles(Profiles.of(PROD_PROFILE));
    }

    String markerKey() {
        return quartzManagedProperties.getBootstrap().getMarkerPrefix() + ":" + activeProfileSegment() + ":" + deployIdSegment();
    }

    String lockKey() {
        return quartzManagedProperties.getBootstrap().getLockKey() + ":" + activeProfileSegment();
    }

    String activeProfileSegment() {
        if (isProdProfileActive()) {
            return PROD_PROFILE;
        }
        String[] activeProfiles = environment.getActiveProfiles();
        if (activeProfiles.length == 0) {
            return "default";
        }
        return Arrays.stream(activeProfiles)
            .filter(Objects::nonNull)
            .filter(profile -> !profile.isBlank())
            .sorted()
            .findFirst()
            .orElse("default");
    }

    String deployIdSegment() {
        String deployId = quartzManagedProperties.getBootstrap().getDeployId();
        return deployId == null ? null : deployId.trim();
    }

    private void validateProdBootstrap(QuartzManagedProperties.Bootstrap bootstrap) {
        if (!bootstrap.isMarkerEnabled()) {
            throw new IllegalStateException("生产环境 Quartz bootstrap reconcile 必须启用 markerEnabled");
        }
        if (deployIdSegment() == null || deployIdSegment().isBlank()) {
            throw new IllegalStateException("生产环境 Quartz bootstrap reconcile 必须提供 deployId");
        }
    }
}
