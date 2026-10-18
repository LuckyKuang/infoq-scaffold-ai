package cc.infoq.system.domain.bo;

import lombok.Data;

import java.util.HashMap;
import java.util.Map;

/**
 * 定时任务日志业务对象 sys_job_log
 *
 * @author Pontus
 */
@Data
public class SysJobLogBo {

    private Long jobLogId;

    private Long jobId;

    private String jobName;

    private String jobGroup;

    private String handlerKey;

    private String triggerSource;

    private String status;

    private Map<String, Object> params = new HashMap<>();
}
