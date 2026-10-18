package cc.infoq.system.domain.entity;

import cc.infoq.common.mybatis.core.domain.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * 参数配置表 sys_config
 *
 * @author Pontus
 */

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("sys_config")
public class SysConfig extends BaseEntity {

    /**
     * 参数主键
     */
    @TableId(value = "config_id")
    private Long configId;

    /**
     * 参数名称
     */
    private String configName;

    /**
     * 参数键名
     */
    private String configKey;

    /**
     * 参数键值
     */
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
    private String configType;

    /**
     * 备注
     */
    private String remark;

}
