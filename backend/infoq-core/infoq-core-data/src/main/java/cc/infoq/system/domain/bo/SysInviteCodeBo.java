package cc.infoq.system.domain.bo;

import cc.infoq.common.mybatis.core.domain.BaseEntity;
import cc.infoq.common.validate.AddGroup;
import cc.infoq.common.validate.EditGroup;
import cc.infoq.system.domain.entity.SysInviteCode;
import io.github.linpeilie.annotations.AutoMapper;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.util.Date;

/**
 * 邀请码业务对象 sys_invite_code.
 *
 * @author Pontus
 */
@Data
@EqualsAndHashCode(callSuper = true)
@AutoMapper(target = SysInviteCode.class, reverseConvertGenerate = false)
public class SysInviteCodeBo extends BaseEntity {

    /**
     * 邀请码ID.
     */
    @NotNull(message = "邀请码ID不能为空", groups = { EditGroup.class })
    private Long inviteId;

    /**
     * 邀请码.
     */
    @Size(max = 32, message = "邀请码长度不能超过32个字符")
    private String inviteCode;

    /**
     * 总状态.
     */
    private String status;

    /**
     * 使用人邮箱.
     */
    @Size(max = 50, message = "使用人邮箱长度不能超过50个字符")
    private String usedUserEmail;

    /**
     * 生成人.
     */
    @Size(max = 30, message = "生成人长度不能超过30个字符")
    private String creatorName;

    /**
     * 生成数量.
     */
    @NotNull(message = "生成数量不能为空", groups = { AddGroup.class })
    @Min(value = 1, message = "生成数量最少为1", groups = { AddGroup.class })
    @Max(value = 100, message = "生成数量最多为100", groups = { AddGroup.class })
    private Integer generateCount;

    /**
     * 过期时间.
     */
    private Date expireTime;

    /**
     * 备注.
     */
    @Size(max = 255, message = "备注长度不能超过255个字符")
    private String remark;

    /**
     * 作废原因.
     */
    @NotBlank(message = "作废原因不能为空", groups = { EditGroup.class })
    @Size(max = 255, message = "作废原因长度不能超过255个字符")
    private String canceledReason;
}
