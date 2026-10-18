package cc.infoq.system.domain.vo;

import lombok.Data;

import java.util.Date;

@Data
public class SysMessageRecipientVo {
    private Long messageId;
    private String messageType;
    private String messageLevel;
    private String title;
    private String content;
    private String source;
    private Date createTime;
    private Date expireTime;
    private Date readTime;
}
