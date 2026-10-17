package cc.infoq.system.domain.bo;

import lombok.Data;

@Data
public class SysMessageQueryBo {
    private String messageType;
    private String readStatus;
}
