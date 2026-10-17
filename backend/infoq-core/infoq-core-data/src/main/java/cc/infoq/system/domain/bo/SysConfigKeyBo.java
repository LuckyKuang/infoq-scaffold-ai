package cc.infoq.system.domain.bo;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * 参数配置键名业务对象
 *
 * @author Pontus
 */
@Data
public class SysConfigKeyBo {

    /**
     * 参数键名
     */
    @NotBlank(message = "参数键名不能为空")
    private String configKey;

}
