package cc.infoq.system.domain.entity;

import cc.infoq.common.mybatis.core.domain.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.util.Date;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("sys_message_recipient")
public class SysMessageRecipient extends BaseEntity {
    @TableId("recipient_id")
    private Long recipientId;
    private Long messageId;
    private Long userId;
    private Date readTime;
    private Date deleteTime;
}
