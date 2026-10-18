package cc.infoq.system.mapper;

import cc.infoq.common.utils.SpringUtils;
import cc.infoq.system.domain.entity.SysDept;
import cc.infoq.system.domain.entity.SysMenu;
import cc.infoq.system.domain.entity.SysPost;
import cc.infoq.system.domain.entity.SysRole;
import cc.infoq.system.domain.entity.SysRoleMenu;
import cc.infoq.system.domain.entity.SysUser;
import cc.infoq.system.domain.entity.SysUserRole;
import cc.infoq.system.domain.vo.SysDeptVo;
import cc.infoq.system.domain.vo.SysPostVo;
import cc.infoq.system.domain.vo.SysRoleVo;
import cc.infoq.system.domain.vo.SysUserVo;
import com.baomidou.dynamic.datasource.DynamicRoutingDataSource;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.apache.ibatis.builder.MapperBuilderAssistant;
import org.apache.ibatis.session.Configuration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.context.support.GenericApplicationContext;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.withSettings;
import static org.mockito.Answers.CALLS_REAL_METHODS;

@Tag("dev")
class MapperDefaultMethodTest {

    @BeforeEach
    void registerTableInfoForLambdaResolution() {
        // MyBatis-Plus 3.5.17 起，默认方法内的 Lambda 列解析依赖 TableInfo/lambda cache，
        // 未注册的实体会抛 "can not find lambda cache"，需显式初始化。
        MapperBuilderAssistant assistant = new MapperBuilderAssistant(new Configuration(), "test");
        for (Class<?> entityType : List.of(SysMenu.class, SysPost.class, SysRole.class, SysRoleMenu.class,
            SysUser.class, SysUserRole.class, SysDept.class)) {
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
    @DisplayName("SysPostMapper.selectPagePostList/selectPostList: should delegate to vo page/list")
    void sysPostMapperDefaultListMethodsShouldDelegate() {
        SysPostMapper mapper = mock(SysPostMapper.class, withSettings().defaultAnswer(CALLS_REAL_METHODS));
        Page<SysPostVo> pageResult = new Page<>();
        List<SysPostVo> listResult = List.of(new SysPostVo());
        Page<SysPost> pageArg = new Page<>(1, 10);
        Wrapper<SysPost> wrapper = new LambdaQueryWrapper<>();

        doReturn(pageResult).when(mapper).selectVoPage(anyPage(), anyWrapper());
        doReturn(listResult).when(mapper).selectVoList(anyWrapper());

        Page<SysPostVo> page = mapper.selectPagePostList(pageArg, wrapper);
        List<SysPostVo> list = mapper.selectPostList(wrapper);

        assertSame(pageResult, page);
        assertSame(listResult, list);
        verify(mapper).selectVoPage(anyPage(), anyWrapper());
        verify(mapper).selectVoList(anyWrapper());
    }

    @Test
    @DisplayName("SysRoleMapper.selectRoleCount/selectRoleById: should delegate to base mapper methods")
    void sysRoleMapperDefaultMethodsShouldDelegate() {
        SysRoleMapper mapper = mock(SysRoleMapper.class, withSettings().defaultAnswer(CALLS_REAL_METHODS));
        SysRoleVo vo = new SysRoleVo();
        when(mapper.selectCount(anyLambdaQueryWrapper())).thenReturn(3L);
        doReturn(vo).when(mapper).selectVoById(9L);

        long count = mapper.selectRoleCount(List.of(1L, 2L, 3L));
        SysRoleVo roleVo = mapper.selectRoleById(9L);

        assertEquals(3L, count);
        assertSame(vo, roleVo);
        verify(mapper).selectCount(anyLambdaQueryWrapper());
        verify(mapper).selectVoById(9L);
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
    @DisplayName("SysUserMapper.countUserById/selectUserList: should delegate to selectCount/selectVoList")
    void sysUserMapperDefaultMethodsShouldDelegate() {
        SysUserMapper mapper = mock(SysUserMapper.class, withSettings().defaultAnswer(CALLS_REAL_METHODS));
        List<SysUserVo> users = List.of(new SysUserVo());
        Wrapper<SysUser> wrapper = new LambdaQueryWrapper<>();
        when(mapper.selectCount(anyLambdaQueryWrapper())).thenReturn(1L);
        doReturn(users).when(mapper).selectVoList(anyWrapper());

        long count = mapper.countUserById(100L);
        List<SysUserVo> result = mapper.selectUserList(wrapper);

        assertEquals(1L, count);
        assertSame(users, result);
        verify(mapper).selectCount(anyLambdaQueryWrapper());
        verify(mapper).selectVoList(anyWrapper());
    }

    @Test
    @DisplayName("SysUserMapper.selectPageUserList: should delegate to selectVoPage")
    void sysUserMapperSelectPageUserListShouldDelegate() {
        SysUserMapper mapper = mock(SysUserMapper.class, withSettings().defaultAnswer(CALLS_REAL_METHODS));
        Page<SysUserVo> pageResult = new Page<>();
        Page<SysUser> pageArg = new Page<>(1, 20);
        Wrapper<SysUser> wrapper = new LambdaQueryWrapper<>();
        doReturn(pageResult).when(mapper).selectVoPage(anyPage(), anyWrapper());

        Page<SysUserVo> page = mapper.selectPageUserList(pageArg, wrapper);

        assertSame(pageResult, page);
        verify(mapper).selectVoPage(anyPage(), anyWrapper());
    }

    @Test
    @DisplayName("SysDeptMapper default methods: should delegate and merge child ids")
    void sysDeptMapperDefaultMethodsShouldWork() {
        prepareDataBaseHelperContext();
        TableInfoHelper.remove(SysDept.class);
        TableInfoHelper.initTableInfo(new MapperBuilderAssistant(new Configuration(), "test"), SysDept.class);
        SysDeptMapper mapper = mock(SysDeptMapper.class, withSettings().defaultAnswer(CALLS_REAL_METHODS));
        SysDept child1 = new SysDept();
        child1.setDeptId(10L);
        SysDept child2 = new SysDept();
        child2.setDeptId(20L);
        List<SysDeptVo> deptVos = List.of(new SysDeptVo());
        Page<SysDeptVo> pageResult = new Page<>();
        Wrapper<SysDept> wrapper = new LambdaQueryWrapper<>();
        doReturn(deptVos).when(mapper).selectVoList(anyWrapper());
        doReturn(pageResult).when(mapper).selectVoPage(anyPage(), anyWrapper());
        when(mapper.selectCount(anyLambdaQueryWrapper())).thenReturn(2L);
        doReturn(List.of(child1, child2)).when(mapper).selectList(anyLambdaQueryWrapper());

        List<SysDeptVo> list = mapper.selectDeptList(wrapper);
        Page<SysDeptVo> page = mapper.selectPageDeptList(new Page<>(1, 10), wrapper);
        long count = mapper.countDeptById(1L);
        List<SysDept> children = mapper.selectListByParentId(1L);
        List<Long> deptIds = mapper.selectDeptAndChildById(1L);

        assertSame(deptVos, list);
        assertSame(pageResult, page);
        assertEquals(2L, count);
        assertEquals(2, children.size());
        assertEquals(List.of(10L, 20L, 1L), deptIds);
        verify(mapper).selectVoList(anyWrapper());
        verify(mapper).selectVoPage(anyPage(), anyWrapper());
        verify(mapper).selectCount(anyLambdaQueryWrapper());
        verify(mapper, times(2)).selectList(anyLambdaQueryWrapper());
    }

    @Test
    @DisplayName("SysRoleMapper.selectPageRoleList/selectRoleList: should delegate to vo page/list")
    void sysRoleMapperListMethodsShouldDelegate() {
        SysRoleMapper mapper = mock(SysRoleMapper.class, withSettings().defaultAnswer(CALLS_REAL_METHODS));
        Page<SysRoleVo> pageResult = new Page<>();
        List<SysRoleVo> listResult = List.of(new SysRoleVo());
        Wrapper<SysRole> wrapper = new LambdaQueryWrapper<>();

        doReturn(pageResult).when(mapper).selectVoPage(anyPage(), anyWrapper());
        doReturn(listResult).when(mapper).selectVoList(anyWrapper());

        Page<SysRoleVo> page = mapper.selectPageRoleList(new Page<>(1, 10), wrapper);
        List<SysRoleVo> list = mapper.selectRoleList(wrapper);

        assertSame(pageResult, page);
        assertSame(listResult, list);
        verify(mapper).selectVoPage(anyPage(), anyWrapper());
        verify(mapper).selectVoList(anyWrapper());
    }

    @Test
    @DisplayName("SysUserRoleMapper.selectUserIdsByRoleId: should delegate to selectObjs")
    void sysUserRoleMapperDefaultMethodShouldDelegate() {
        TableInfoHelper.remove(SysUserRole.class);
        TableInfoHelper.initTableInfo(new MapperBuilderAssistant(new Configuration(), "test"), SysUserRole.class);
        SysUserRoleMapper mapper = mock(SysUserRoleMapper.class, withSettings().defaultAnswer(CALLS_REAL_METHODS));
        when(mapper.selectObjs(anyLambdaQueryWrapper())).thenReturn(List.of(1L, 2L));

        List<Long> result = mapper.selectUserIdsByRoleId(9L);

        assertEquals(List.of(1L, 2L), result);
        verify(mapper).selectObjs(anyLambdaQueryWrapper());
    }

    private static void prepareDataBaseHelperContext() {
        DynamicRoutingDataSource dynamicRoutingDataSource = mock(DynamicRoutingDataSource.class);
        DataSource dataSource = mock(DataSource.class);
        Connection connection = mock(Connection.class);
        DatabaseMetaData databaseMetaData = mock(DatabaseMetaData.class);

        try {
            when(dynamicRoutingDataSource.determineDataSource()).thenReturn(dataSource);
            when(dataSource.getConnection()).thenReturn(connection);
            when(connection.getMetaData()).thenReturn(databaseMetaData);
            when(databaseMetaData.getDatabaseProductName()).thenReturn("MySQL");
        } catch (Exception ex) {
            throw new RuntimeException(ex);
        }

        GenericApplicationContext context = new GenericApplicationContext();
        context.registerBean(DynamicRoutingDataSource.class, () -> dynamicRoutingDataSource);
        context.refresh();
        new SpringUtils().setApplicationContext(context);
    }

    private static <T> LambdaQueryWrapper<T> anyLambdaQueryWrapper() {
        return any();
    }

    private static <T> LambdaUpdateWrapper<T> anyLambdaUpdateWrapper() {
        return any();
    }

    private static <T> Page<T> anyPage() {
        return any();
    }

    private static <T> Wrapper<T> anyWrapper() {
        return any();
    }
}
