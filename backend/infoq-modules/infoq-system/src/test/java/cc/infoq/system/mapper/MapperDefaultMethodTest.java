package cc.infoq.system.mapper;

import cc.infoq.system.domain.entity.SysMenu;
import cc.infoq.system.domain.entity.SysPost;
import cc.infoq.system.domain.entity.SysRole;
import cc.infoq.system.domain.entity.SysRoleMenu;
import cc.infoq.system.domain.entity.SysUser;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import org.apache.ibatis.builder.MapperBuilderAssistant;
import org.apache.ibatis.session.Configuration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@Tag("dev")
class MapperDefaultMethodTest {

    @BeforeEach
    void registerTableInfoForLambdaResolution() {
        // MyBatis-Plus 3.5.17 起，默认方法内的 Lambda 列解析依赖 TableInfo/lambda cache，
        // 未注册的实体会抛 "can not find lambda cache"，需显式初始化。
        MapperBuilderAssistant assistant = new MapperBuilderAssistant(new Configuration(), "test");
        for (Class<?> entityType : List.of(SysMenu.class, SysPost.class, SysRole.class, SysRoleMenu.class,
            SysUser.class)) {
            TableInfoHelper.remove(entityType);
            TableInfoHelper.initTableInfo(assistant, entityType);
        }
    }

    @Test
    @DisplayName("SysMenuMapper.selectMenuTreeAll: should delegate to selectList")
    void sysMenuMapperSelectMenuTreeAllShouldDelegate() {
        SysMenuMapper mapper = mock(SysMenuMapper.class, withSettings().defaultAnswer(CALLS_REAL_METHODS));
        List<SysMenu> menus = List.of(new SysMenu());
        when(mapper.selectList(anyLambdaQueryWrapper())).thenReturn(menus);

        List<SysMenu> result = mapper.selectMenuTreeAll();

        assertSame(menus, result);
        verify(mapper).selectList(anyLambdaQueryWrapper());
    }

    @Test
    @DisplayName("SysPostMapper.selectPostCount: should delegate to selectCount")
    void sysPostMapperSelectPostCountShouldDelegate() {
        SysPostMapper mapper = mock(SysPostMapper.class, withSettings().defaultAnswer(CALLS_REAL_METHODS));
        when(mapper.selectCount(anyLambdaQueryWrapper())).thenReturn(2L);

        long result = mapper.selectPostCount(List.of(1L, 2L));

        assertEquals(2L, result);
        verify(mapper).selectCount(anyLambdaQueryWrapper());
    }

    @Test
    @DisplayName("SysRoleMapper.selectRoleCount: should delegate to selectCount")
    void sysRoleMapperSelectRoleCountShouldDelegate() {
        SysRoleMapper mapper = mock(SysRoleMapper.class, withSettings().defaultAnswer(CALLS_REAL_METHODS));
        when(mapper.selectCount(anyLambdaQueryWrapper())).thenReturn(3L);

        long result = mapper.selectRoleCount(List.of(1L, 2L, 3L));

        assertEquals(3L, result);
        verify(mapper).selectCount(anyLambdaQueryWrapper());
    }

    @Test
    @DisplayName("SysRoleMenuMapper.deleteByMenuIds: should delegate to delete")
    void sysRoleMenuMapperDeleteByMenuIdsShouldDelegate() {
        SysRoleMenuMapper mapper = mock(SysRoleMenuMapper.class, withSettings().defaultAnswer(CALLS_REAL_METHODS));
        when(mapper.delete(anyLambdaUpdateWrapper())).thenReturn(1);

        int rows = mapper.deleteByMenuIds(List.of(9L));

        assertEquals(1, rows);
        verify(mapper).delete(anyLambdaUpdateWrapper());
    }

    @Test
    @DisplayName("SysUserMapper.countUserById: should delegate to selectCount")
    void sysUserMapperCountUserByIdShouldDelegate() {
        SysUserMapper mapper = mock(SysUserMapper.class, withSettings().defaultAnswer(CALLS_REAL_METHODS));
        when(mapper.selectCount(anyLambdaQueryWrapper())).thenReturn(1L);

        long count = mapper.countUserById(100L);

        assertEquals(1L, count);
        verify(mapper).selectCount(anyLambdaQueryWrapper());
    }

    private static <T> LambdaQueryWrapper<T> anyLambdaQueryWrapper() {
        return any();
    }

    private static <T> LambdaUpdateWrapper<T> anyLambdaUpdateWrapper() {
        return any();
    }

}
