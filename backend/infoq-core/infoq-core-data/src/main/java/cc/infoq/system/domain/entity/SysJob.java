package cc.infoq.system.domain.entity;

import cc.infoq.common.mybatis.core.domain.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.io.Serial;

/**
 * 定时任务对象 sys_job
 *
 * @author Pontus
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("sys_job")
public class SysJob extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    @TableId(value = "job_id")
    private Long jobId;

    private String jobName;

    private String jobGroup;

    private String handlerKey;

    private String handlerParams;

    private String cronExpression;

    private String misfirePolicy;

    private String concurrent;

    private String status;

    private String remark;

    @TableLogic
    private String delFlag;
}
