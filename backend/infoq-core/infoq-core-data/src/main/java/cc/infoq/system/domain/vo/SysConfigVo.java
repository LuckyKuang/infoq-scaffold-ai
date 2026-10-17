package cc.infoq.system.domain.vo;

import cc.infoq.common.excel.annotation.ExcelDictFormat;
import cc.infoq.common.excel.convert.ExcelDictConvert;
import cc.infoq.system.domain.entity.SysConfig;
import cn.idev.excel.annotation.ExcelIgnoreUnannotated;
import cn.idev.excel.annotation.ExcelProperty;
import io.github.linpeilie.annotations.AutoMapper;
import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.util.Date;


/**
 * 参数配置视图对象 sys_config
 *
 * @author Pontus
 */
@Data
@ExcelIgnoreUnannotated
@AutoMapper(target = SysConfig.class)
public class SysConfigVo implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 参数主键
     */
    @ExcelProperty(value = "参数主键")
    private Long configId;

    /**
     * 参数名称
     */
    @ExcelProperty(value = "参数名称")
    private String configName;

    /**
     * 参数键名
     */
    @ExcelProperty(value = "参数键名")
    private String configKey;

    /**
     * 参数键值
     */
    @ExcelProperty(value = "参数键值")
    private String configValue;

    /**
     * 参数值类型
     */
    private String valueType;

    /**
     * 默认值，null 表示无默认值
     */
    private String defaultValue;

    /**
     * 配置分组
     */
    private String groupKey;

    /**
     * 显示顺序
     */
    private Integer displayOrder;

    /**
     * 下拉选项 JSON
     */
    private String optionsJson;

    /**
     * UI 属性 JSON
     */
    private String uiPropsJson;

    /**
     * 系统内置（Y是 N否）
     */
    @ExcelProperty(value = "系统内置", converter = ExcelDictConvert.class)
    @ExcelDictFormat(dictType = "sys_yes_no")
    private String configType;

    /**
     * 备注
     */
    @ExcelProperty(value = "备注")
    private String remark;

    /**
     * 创建时间
     */
    @ExcelProperty(value = "创建时间")
    private Date createTime;

}
