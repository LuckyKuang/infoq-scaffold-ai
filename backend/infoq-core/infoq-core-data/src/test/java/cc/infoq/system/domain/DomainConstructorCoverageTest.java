package cc.infoq.system.domain;

import cc.infoq.common.constant.SystemConstants;
import cc.infoq.system.domain.bo.SysRoleBo;
import cc.infoq.system.domain.bo.SysUserBo;
import cc.infoq.system.domain.entity.SysCache;
import cc.infoq.system.domain.entity.SysDictData;
import cc.infoq.system.domain.entity.SysRole;
import cc.infoq.system.domain.entity.SysUser;
import cc.infoq.system.domain.vo.MetaVo;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Tag("dev")
class DomainConstructorCoverageTest {

    @Test
    @DisplayName("SysCache constructors: should normalize cache name/key and keep remark")
    void sysCacheConstructorsShouldWork() {
        SysCache withRemark = new SysCache("sys:cache", "remark");
        assertEquals("sys:cache", withRemark.getCacheName());
        assertEquals("remark", withRemark.getRemark());

        SysCache withValue = new SysCache("sys:cache", "sys:cache:user:1", "v");
        assertEquals("syscache", withValue.getCacheName());
        assertEquals(":user:1", withValue.getCacheKey());
        assertEquals("v", withValue.getCacheValue());
    }

    @Test
    @DisplayName("MetaVo constructors: should guard link/activeMenu by format")
    void metaVoConstructorsShouldWork() {
        MetaVo basic = new MetaVo("title", "icon");
        assertEquals("title", basic.getTitle());
        assertEquals("icon", basic.getIcon());

        MetaVo noCache = new MetaVo("title", "icon", true);
        assertTrue(noCache.getNoCache());

        MetaVo linkOnly = new MetaVo("title", "icon", "https://example.com");
        assertEquals("https://example.com", linkOnly.getLink());

        MetaVo guardedLink = new MetaVo("title", "icon", true, "javascript:alert(1)");
        assertNull(guardedLink.getLink());

        MetaVo withActiveMenu = new MetaVo("title", "icon", false, "https://example.com/a", "/system/user");
        assertEquals("/system/user", withActiveMenu.getActiveMenu());

        MetaVo invalidActiveMenu = new MetaVo("title", "icon", false, "https://example.com/a", "system/user");
        assertNull(invalidActiveMenu.getActiveMenu());
    }

    @Test
    @DisplayName("Domain one-arg constructors: should assign id and support super-admin checks")
    void oneArgConstructorsShouldWork() {
        SysRoleBo roleBo = new SysRoleBo(1L);
        SysUserBo userBo = new SysUserBo(1L);
        SysRole role = new SysRole(2L);
        SysUser user = new SysUser(1L);

        assertEquals(1L, roleBo.getRoleId());
        assertTrue(roleBo.isSuperAdmin());
        assertEquals(1L, userBo.getUserId());
        assertTrue(userBo.isSuperAdmin());
        assertEquals(2L, role.getRoleId());
        assertEquals(1L, user.getUserId());
        assertTrue(user.isSuperAdmin());
    }

    @Test
    @DisplayName("SysDictData.getDefault: should return true only when isDefault equals YES")
    void sysDictDataGetDefaultShouldReflectYesFlag() {
        SysDictData yes = new SysDictData();
        yes.setIsDefault(SystemConstants.YES);
        SysDictData no = new SysDictData();
        no.setIsDefault("N");

        assertTrue(yes.getDefault());
        assertFalse(no.getDefault());
    }
}
