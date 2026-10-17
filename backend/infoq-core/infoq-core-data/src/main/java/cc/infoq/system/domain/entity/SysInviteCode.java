package cc.infoq.system.domain.entity;

import cc.infoq.common.mybatis.core.domain.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.util.Date;

/**
 * 邀请码对象 sys_invite_code.
 *
 * @author Pontus
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("sys_invite_code")
public class SysInviteCode extends BaseEntity {

    /**
     * 邀请码ID.
     */
    @TableId(value = "invite_id")
    private Long inviteId;

    /**
     * 邀请码.
     */
    private String inviteCode;

    /**
     * 总状态.
     */
    private String status;

    /**
     * 过期时间.
     */
    private Date expireTime;

    /**
     * 使用人ID.
     */
    private Long usedUserId;

    /**
     * 使用时间.
     */
    private Date usedTime;

    /**
     * 作废时间.
     */
    private Date canceledTime;

    /**
     * 作废原因.
     */
    private String canceledReason;

    /**
     * 备注.
     */
    private String remark;
}
