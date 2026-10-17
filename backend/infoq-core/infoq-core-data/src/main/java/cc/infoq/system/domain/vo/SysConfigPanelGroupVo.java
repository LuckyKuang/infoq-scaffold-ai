package cc.infoq.system.domain.vo;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

/**
 * 参数配置面板分组视图对象
 *
 * @author Pontus
 */
@Data
public class SysConfigPanelGroupVo implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    private String groupKey;

    private String groupName;

    private Integer displayOrder;

    private List<SysConfigPanelItemVo> items = new ArrayList<>();

}
