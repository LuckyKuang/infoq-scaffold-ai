package cc.infoq.common.quartz.config;

import cc.infoq.common.quartz.core.ManagedQuartzJobExecutor;
import cc.infoq.common.quartz.properties.QuartzManagedProperties;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

/**
 * Quartz 自动配置
 *
 * @author Pontus
 */
@AutoConfiguration
@EnableConfigurationProperties(QuartzManagedProperties.class)
@ConditionalOnProperty(prefix = "infoq.quartz", name = "enabled", havingValue = "true", matchIfMissing = true)
@ConditionalOnBean(ManagedQuartzJobExecutor.class)
public class QuartzAutoConfiguration {
}
