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
}
