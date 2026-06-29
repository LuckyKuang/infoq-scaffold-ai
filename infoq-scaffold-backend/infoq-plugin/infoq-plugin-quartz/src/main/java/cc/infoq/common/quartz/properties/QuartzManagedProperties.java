package cc.infoq.common.quartz.properties;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Quartz 托管任务配置
 *
 * @author Pontus
 */
@Data
@ConfigurationProperties(prefix = "infoq.quartz")
public class QuartzManagedProperties {

    /**
     * 是否启用托管调度能力
     */
    private boolean enabled = true;

    /**
     * Quartz 组名前缀，避免误删或误扫其它 Job
     */
    private String managedGroupPrefix = "SYS_";

    /**
     * 启动期 bootstrap 配置
     */
    private Bootstrap bootstrap = new Bootstrap();

    @Data
    public static class Bootstrap {

        /**
         * 是否启用启动期 reconcile
         */
        private boolean reconcileEnabled = true;

        /**
         * 生产环境是否启用受控保护逻辑
         */
        private boolean productionGuardEnabled = false;

        /**
         * 是否启用已执行 marker
         */
        private boolean markerEnabled = false;

        /**
         * marker key 前缀
         */
        private String markerPrefix = "infoq:quartz:bootstrap:applied";

        /**
         * 当前部署批次唯一标识；推荐格式为 版本号-日期-序号，例如 2.1.6-20260602120000。
         * 生产环境开启受控 reconcile 时必须提供，并且同一次部署的所有节点必须保持一致。
         */
        private String deployId;

        /**
         * 全局锁 key
         */
        private String lockKey = "infoq:quartz:bootstrap-reconcile";

        /**
         * 获取锁超时时间，单位毫秒
         */
        private long lockAcquireTimeout = 3000L;

        /**
         * 锁过期时间，单位毫秒。-1 交由 redisson 自动续期
         */
        private long lockExpire = -1L;
    }
}
