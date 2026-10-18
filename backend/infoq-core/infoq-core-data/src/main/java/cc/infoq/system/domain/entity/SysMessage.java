package cc.infoq.system.domain.entity;

import cc.infoq.common.mybatis.core.domain.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.util.Date;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("sys_message")
public class SysMessage extends BaseEntity {
    @TableId("message_id")
    private Long messageId;
    private String messageType;
    private String messageLevel;
    private String title;
    private String content;
    private String source;
    private String businessKey;
    private Date expireTime;
}
