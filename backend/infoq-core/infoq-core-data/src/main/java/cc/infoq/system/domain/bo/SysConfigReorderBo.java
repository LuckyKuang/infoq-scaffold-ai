package cc.infoq.system.domain.bo;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * 参数配置排序业务对象
 *
 * @author Pontus
 */
@Data
public class SysConfigReorderBo {

    /**
     * 参数主键
     */
    @NotNull(message = "参数主键不能为空")
    private Long configId;

    /**
     * 配置分组
     */
    @NotBlank(message = "配置分组不能为空")
    private String groupKey;

    /**
     * 显示顺序
     */
    @NotNull(message = "显示顺序不能为空")
    private Integer displayOrder;

}
