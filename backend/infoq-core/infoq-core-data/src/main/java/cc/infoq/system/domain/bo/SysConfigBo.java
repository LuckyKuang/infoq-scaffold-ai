package cc.infoq.system.domain.bo;

import cc.infoq.common.mybatis.core.domain.BaseEntity;
import cc.infoq.common.validate.UpdateByKeyGroup;
import cc.infoq.system.domain.entity.SysConfig;
import io.github.linpeilie.annotations.AutoMapper;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import jakarta.validation.groups.Default;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * 参数配置业务对象 sys_config
 *
 * @author Pontus
 */

@Data
@EqualsAndHashCode(callSuper = true)
@AutoMapper(target = SysConfig.class, reverseConvertGenerate = false)
public class SysConfigBo extends BaseEntity {

    /**
     * 参数主键
     */
    private Long configId;

    /**
     * 参数名称
     */
    @NotBlank(message = "参数名称不能为空")
    @Size(min = 0, max = 100, message = "参数名称不能超过{max}个字符")
    private String configName;

    /**
     * 参数键名
     */
    @NotBlank(message = "参数键名不能为空", groups = { Default.class, UpdateByKeyGroup.class })
    @Size(min = 0, max = 100, message = "参数键名长度不能超过{max}个字符")
    private String configKey;

    /**
     * 参数键值
     */
    @NotBlank(message = "参数键值不能为空", groups = { Default.class, UpdateByKeyGroup.class })
    @Size(min = 0, max = 500, message = "参数键值长度不能超过{max}个字符")
    private String configValue;

    /**
     * 参数值类型
     */
    @Size(min = 0, max = 20, message = "参数值类型不能超过{max}个字符")
    private String valueType;

    /**
     * 默认值，null 表示无默认值
     */
    private String defaultValue;

    /**
     * 配置分组
     */
    @Size(min = 0, max = 50, message = "配置分组不能超过{max}个字符")
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
