package cc.infoq.system.mapper;

import cc.infoq.common.mybatis.core.mapper.BaseMapperPlus;
import cc.infoq.system.domain.entity.SysUserRole;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;

import java.util.List;

/**
 * 用户与角色关联表 数据层
 *
 * @author Pontus
 */
public interface SysUserRoleMapper extends BaseMapperPlus<SysUserRole, SysUserRole> {

    /**
     * 根据角色ID查询关联的用户ID列表
     *
     * @param roleId 角色ID
     * @return 关联到指定角色的用户ID列表
     */
    default List<Long> selectUserIdsByRoleId(Long roleId) {
        return this.selectObjs(new LambdaQueryWrapper<SysUserRole>()
            .select(SysUserRole::getUserId).eq(SysUserRole::getRoleId, roleId)
        );
    }

}
