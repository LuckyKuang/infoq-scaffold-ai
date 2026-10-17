package cc.infoq.system.domain.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.util.Date;

/**
 * 定时任务日志对象 sys_job_log
 *
 * @author Pontus
 */
@Data
@TableName("sys_job_log")
public class SysJobLog implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @TableId(value = "job_log_id")
    private Long jobLogId;

    private Long jobId;

    private String jobName;

    private String jobGroup;

    private String handlerKey;

    private String handlerParams;

    private String triggerSource;

    private String jobMessage;

    private String status;

    private String exceptionInfo;

    private Long durationMs;

    private Date startTime;

    private Date endTime;
}
