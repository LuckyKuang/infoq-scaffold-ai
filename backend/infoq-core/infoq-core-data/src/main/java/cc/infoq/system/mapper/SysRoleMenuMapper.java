package cc.infoq.system.mapper;

import cc.infoq.common.mybatis.core.mapper.BaseMapperPlus;
import cc.infoq.system.domain.entity.SysRoleMenu;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;

import java.util.List;

/**
 * 角色与菜单关联表 数据层
 *
 * @author Pontus
 */
public interface SysRoleMenuMapper extends BaseMapperPlus<SysRoleMenu, SysRoleMenu> {

    /**
     * 根据菜单ID串删除关联关系
     *
     * @param menuIds 菜单ID串
     * @return 结果
     */
    default int deleteByMenuIds(List<Long> menuIds) {
        return this.delete(new LambdaUpdateWrapper<SysRoleMenu>().in(SysRoleMenu::getMenuId, menuIds));
    }

}
