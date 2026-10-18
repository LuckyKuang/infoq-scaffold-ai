package cc.infoq.system.domain.vo;

import cc.infoq.common.excel.annotation.ExcelDictFormat;
import cc.infoq.common.excel.convert.ExcelDictConvert;
import cc.infoq.system.domain.entity.SysJob;
import cn.idev.excel.annotation.ExcelIgnoreUnannotated;
import cn.idev.excel.annotation.ExcelProperty;
import io.github.linpeilie.annotations.AutoMapper;
import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.util.Date;

/**
 * 定时任务视图对象 sys_job
 *
 * @author Pontus
 */
@Data
@ExcelIgnoreUnannotated
@AutoMapper(target = SysJob.class)
public class SysJobVo implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

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

    @ExcelProperty(value = "Cron表达式")
    private String cronExpression;

    @ExcelProperty(value = "错过策略", converter = ExcelDictConvert.class)
    @ExcelDictFormat(dictType = "sys_job_misfire_policy")
    private String misfirePolicy;

    @ExcelProperty(value = "并发策略", converter = ExcelDictConvert.class)
    @ExcelDictFormat(dictType = "sys_job_concurrent")
    private String concurrent;

    @ExcelProperty(value = "状态", converter = ExcelDictConvert.class)
    @ExcelDictFormat(readConverterExp = "0=正常,1=暂停")
    private String status;

    @ExcelProperty(value = "备注")
    private String remark;

    private Long createBy;

    private Date createTime;

    private Long updateBy;

    private Date updateTime;
}
