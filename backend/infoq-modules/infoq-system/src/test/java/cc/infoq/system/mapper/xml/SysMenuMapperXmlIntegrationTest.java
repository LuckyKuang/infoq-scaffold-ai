package cc.infoq.system.mapper.xml;

import cc.infoq.system.mapper.SysMenuMapper;
import cc.infoq.system.mapper.support.MapperXmlIT;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

@MapperXmlIT
class SysMenuMapperXmlIntegrationTest {

    @Autowired
    private SysMenuMapper sysMenuMapper;

    @Test
    void selectMenuQueriesShouldRespectRoleStatusAndPermFilters() {
        List<Long> menuIds = sysMenuMapper.selectMenuIdsByUserId(501L);
        Set<String> permsByUser = sysMenuMapper.selectMenuPermsByUserId(501L);
        Set<String> permsByRole = sysMenuMapper.selectMenuPermsByRoleId(10L);
        List<Long> roleMenus = sysMenuMapper.selectMenuListByRoleId(10L, false);
        List<Long> strictRoleMenus = sysMenuMapper.selectMenuListByRoleId(10L, true);

        assertThat(menuIds).containsExactlyInAnyOrder(1L, 2L, 3L, 4L, 5L);
        assertThat(permsByUser).containsExactlyInAnyOrder("system:user:list", "system:menu:view");
        assertThat(permsByRole).containsExactlyInAnyOrder("system:user:list", "system:menu:view");
        assertThat(roleMenus).containsExactly(1L, 4L, 5L, 2L, 3L);
        assertThat(strictRoleMenus).containsExactly(4L, 5L, 2L, 3L);
    }

    @Test
    void selectMenuListByRoleIdShouldIncludeDisabledRoleForEditTree() {
        // role 11 为停用角色：编辑角色时必须回显其已有菜单，否则保存会清空授权
        assertThat(sysMenuMapper.selectMenuListByRoleId(11L, false)).containsExactly(4L, 2L);
        assertThat(sysMenuMapper.selectMenuListByRoleId(11L, true)).containsExactly(4L, 2L);
        // 登录权限查询仍然只认启用角色
        assertThat(sysMenuMapper.selectMenuIdsByUserId(502L)).isEmpty();
    }
}
