package cc.infoq.system.domain.entity;

import cc.infoq.common.validate.GrantGroup;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * 用户和角色关联 sys_user_role
 *
 * @author Pontus
 */

@Data
@TableName("sys_user_role")
public class SysUserRole {

    /**
     * 用户ID
     */
    @TableId(type = IdType.INPUT)
    @NotNull(message = "用户ID不能为空", groups = { GrantGroup.class })
    private Long userId;

    /**
     * 角色ID
     */
    @NotNull(message = "角色ID不能为空", groups = { GrantGroup.class })
    private Long roleId;

}
