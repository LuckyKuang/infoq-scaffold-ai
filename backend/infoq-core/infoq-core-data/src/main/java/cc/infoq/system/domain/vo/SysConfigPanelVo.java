package cc.infoq.system.domain.vo;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.util.List;

/**
 * 参数配置面板视图对象
 *
 * @author Pontus
 */
@Data
public class SysConfigPanelVo implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    private List<SysConfigPanelGroupVo> groups;

}
