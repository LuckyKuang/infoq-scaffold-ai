package cc.infoq.system.domain.vo;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.util.Date;
import java.util.List;
import java.util.Map;

/**
 * 参数配置面板项视图对象
 *
 * @author Pontus
 */
@Data
public class SysConfigPanelItemVo implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    private Long configId;

    private String configName;

    private String configKey;

    private String configValue;

    private String configType;

    private String valueType;

    private String defaultValue;

    private String groupKey;

    private Integer displayOrder;

    private List<SysConfigOptionVo> options;

    private Map<String, Object> uiProps;

    private Boolean editable;

    private String editableReason;

    private String remark;

    private Date createTime;

    private Date updateTime;

}
