package cc.infoq.common.quartz.core;

import org.quartz.DisallowConcurrentExecution;

/**
 * 禁止并发执行的 Quartz Job
 *
 * @author Pontus
 */
@DisallowConcurrentExecution
public class ManagedQuartzDisallowConcurrentJob extends ManagedQuartzJob {
}
