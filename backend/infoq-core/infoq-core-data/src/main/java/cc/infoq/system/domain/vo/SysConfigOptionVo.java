package cc.infoq.system.domain.vo;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;

/**
 * 参数配置选项视图对象
 *
 * @author Pontus
 */
@Data
public class SysConfigOptionVo implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 展示文本
     */
    private String label;

    /**
     * 实际值
     */
    private String value;

}
