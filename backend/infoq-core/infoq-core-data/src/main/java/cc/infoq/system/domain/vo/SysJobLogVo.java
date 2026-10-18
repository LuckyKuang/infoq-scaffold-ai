package cc.infoq.system.domain.vo;

import cc.infoq.common.excel.annotation.ExcelDictFormat;
import cc.infoq.common.excel.convert.ExcelDictConvert;
import cc.infoq.system.domain.entity.SysJobLog;
import cn.idev.excel.annotation.ExcelIgnoreUnannotated;
import cn.idev.excel.annotation.ExcelProperty;
import io.github.linpeilie.annotations.AutoMapper;
import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.util.Date;

/**
 * 定时任务日志视图对象 sys_job_log
 *
 * @author Pontus
 */
@Data
@ExcelIgnoreUnannotated
@AutoMapper(target = SysJobLog.class)
public class SysJobLogVo implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @ExcelProperty(value = "日志ID")
    private Long jobLogId;

    @ExcelProperty(value = "任务ID")
    private Long jobId;

    @ExcelProperty(value = "任务名称")
    private String jobName;

    @ExcelProperty(value = "任务分组")
    private String jobGroup;

    @ExcelProperty(value = "处理器标识")
    private String handlerKey;

    @ExcelProperty(value = "处理器参数")
    private String handlerParams;

    @ExcelProperty(value = "触发来源")
    private String triggerSource;

    @ExcelProperty(value = "执行消息")
    private String jobMessage;

    @ExcelProperty(value = "执行状态", converter = ExcelDictConvert.class)
    @ExcelDictFormat(dictType = "sys_common_status")
    private String status;

    @ExcelProperty(value = "异常信息")
    private String exceptionInfo;

    @ExcelProperty(value = "耗时(毫秒)")
    private Long durationMs;

    @ExcelProperty(value = "开始时间")
    private Date startTime;

    @ExcelProperty(value = "结束时间")
    private Date endTime;
}
