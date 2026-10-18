package cc.infoq.system.domain.bo;

import cc.infoq.common.json.validate.JsonPattern;
import cc.infoq.common.json.validate.JsonType;
import cc.infoq.common.mybatis.core.domain.BaseEntity;
import cc.infoq.common.validate.AddGroup;
import cc.infoq.common.validate.EditGroup;
import cc.infoq.common.validate.StatusGroup;
import cc.infoq.system.domain.entity.SysJob;
import io.github.linpeilie.annotations.AutoMapper;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * 定时任务业务对象 sys_job
 *
 * @author Pontus
 */
@Data
@EqualsAndHashCode(callSuper = true)
@AutoMapper(target = SysJob.class, reverseConvertGenerate = false)
public class SysJobBo extends BaseEntity {

    @NotNull(message = "任务ID不能为空", groups = { EditGroup.class, StatusGroup.class })
    private Long jobId;

    @NotBlank(message = "任务名称不能为空", groups = { AddGroup.class, EditGroup.class })
    private String jobName;

    @NotBlank(message = "任务分组不能为空", groups = { AddGroup.class, EditGroup.class })
    private String jobGroup;

    @NotBlank(message = "处理器标识不能为空", groups = { AddGroup.class, EditGroup.class })
    private String handlerKey;

    @JsonPattern(type = JsonType.OBJECT, message = "处理器参数必须是JSON对象")
    private String handlerParams;

    @NotBlank(message = "Cron表达式不能为空", groups = { AddGroup.class, EditGroup.class })
    private String cronExpression;

    @NotBlank(message = "错过策略不能为空", groups = { AddGroup.class, EditGroup.class })
    private String misfirePolicy;

    @NotBlank(message = "并发策略不能为空", groups = { AddGroup.class, EditGroup.class })
    private String concurrent;

    @NotBlank(message = "状态不能为空", groups = { AddGroup.class, EditGroup.class, StatusGroup.class })
    private String status;

    private String remark;
}
