package cc.infoq.system.service.impl;

import cc.infoq.common.constant.CacheNames;
import cc.infoq.common.constant.SystemConstants;
import cc.infoq.common.domain.dto.DeptDTO;
import cc.infoq.common.exception.ServiceException;
import cc.infoq.common.mybatis.core.page.PageQuery;
import cc.infoq.common.mybatis.core.page.TableDataInfo;
import cc.infoq.common.redis.utils.CacheUtils;
import cc.infoq.common.security.auth.LoginUserContext;
import cc.infoq.common.utils.MapstructUtils;
import cc.infoq.common.utils.SpringUtils;
import cc.infoq.system.domain.bo.SysDeptBo;
import cc.infoq.system.domain.entity.SysDept;
import cc.infoq.system.domain.entity.SysRole;
import cc.infoq.system.domain.entity.SysUser;
import cc.infoq.system.domain.vo.SysDeptVo;
import cc.infoq.system.mapper.SysDeptMapper;
import cc.infoq.system.mapper.SysRoleMapper;
import cc.infoq.system.mapper.SysUserMapper;
import cn.hutool.core.lang.tree.Tree;
import com.baomidou.dynamic.datasource.DynamicRoutingDataSource;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import io.github.linpeilie.Converter;
import org.apache.ibatis.builder.MapperBuilderAssistant;
import org.apache.ibatis.session.Configuration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.context.support.GenericApplicationContext;

import javax.sql.DataSource;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.mockito.Mockito.eq;

@ExtendWith(MockitoExtension.class)
@Tag("dev")
class SysDeptServiceImplTest {

    @Mock
    private SysDeptMapper sysDeptMapper;

    @Mock
    private SysRoleMapper sysRoleMapper;

    @Mock
    private SysUserMapper sysUserMapper;

    private Converter converter;
    private CacheManager cacheManager;
    private Cache cache;
    private DynamicRoutingDataSource dynamicRoutingDataSource;
    private DataSource dataSource;
    private Connection connection;
    private DatabaseMetaData databaseMetaData;

    @BeforeEach
    void setUp() throws Exception {
        converter = mock(Converter.class);
        cacheManager = mock(CacheManager.class);
        cache = mock(Cache.class);
        dynamicRoutingDataSource = mock(DynamicRoutingDataSource.class);
        dataSource = mock(DataSource.class);
        connection = mock(Connection.class);
        databaseMetaData = mock(DatabaseMetaData.class);
        GenericApplicationContext context = new GenericApplicationContext();
        context.registerBean(Converter.class, () -> converter);
        context.registerBean(CacheManager.class, () -> cacheManager);
        context.registerBean(DynamicRoutingDataSource.class, () -> dynamicRoutingDataSource);
        context.refresh();
        new SpringUtils().setApplicationContext(context);
        lenient().when(cacheManager.getCache(anyString())).thenReturn(cache);
        lenient().when(dynamicRoutingDataSource.determineDataSource()).thenReturn(dataSource);
        lenient().when(dataSource.getConnection()).thenReturn(connection);
        lenient().when(connection.getMetaData()).thenReturn(databaseMetaData);
        lenient().when(databaseMetaData.getDatabaseProductName()).thenReturn("MySQL");
        if (TableInfoHelper.getTableInfo(SysDept.class) == null) {
            TableInfoHelper.initTableInfo(new MapperBuilderAssistant(new Configuration(), ""), SysDept.class);
        }
        if (TableInfoHelper.getTableInfo(SysUser.class) == null) {
            TableInfoHelper.initTableInfo(new MapperBuilderAssistant(new Configuration(), ""), SysUser.class);
        }
    }

    @Test
    @DisplayName("selectDeptList: should build query wrapper including belongDept tree filter")
    void selectDeptListShouldBuildQueryWrapperIncludingBelongDeptTreeFilter() {
        SysDeptServiceImpl service = newService();
        SysDeptBo bo = new SysDeptBo();
        bo.setDeptId(10L);
        bo.setParentId(1L);
        bo.setDeptName("研发");
        bo.setDeptCategory("RD");
        bo.setStatus(SystemConstants.NORMAL);
        bo.setBelongDeptId(1L);
        bo.getParams().put("beginTime", "2026-03-01 00:00:00");
        bo.getParams().put("endTime", "2026-03-31 23:59:59");
        when(sysDeptMapper.selectDeptAndChildById(1L)).thenReturn(List.of(1L, 10L, 11L));
        SysDeptVo vo = new SysDeptVo();
        vo.setDeptId(10L);
        vo.setDeptName("研发");
        when(sysDeptMapper.selectDeptList(any())).thenReturn(List.of(vo));

        List<SysDeptVo> list = service.selectDeptList(bo);

        assertEquals(1, list.size());
        assertEquals(10L, list.get(0).getDeptId());
        verify(sysDeptMapper).selectDeptAndChildById(1L);
    }

    @Test
    @DisplayName("selectPageDeptList: should return mapper page data")
    void selectPageDeptListShouldReturnMapperPageData() {
        SysDeptServiceImpl service = newService();
        SysDeptBo bo = new SysDeptBo();
        bo.setDeptName("研发");
        Page<SysDeptVo> page = new Page<>(1, 10);
        page.setTotal(1);
        page.setRecords(List.of(deptVo(10L, "研发", 1L)));
        when(sysDeptMapper.selectPageDeptList(any(), any())).thenReturn(page);

        TableDataInfo<SysDeptVo> table = service.selectPageDeptList(bo, new PageQuery(1, 10));

        assertEquals(1L, table.getTotal());
        assertEquals(1, table.getRows().size());
        assertEquals("研发", table.getRows().get(0).getDeptName());
    }

    @Test
    @DisplayName("selectDeptTreeList: should query mapper and build tree result")
    void selectDeptTreeListShouldBuildTreeFromMapperResult() {
        SysDeptServiceImpl service = newService();
        SysDeptBo bo = new SysDeptBo();
        bo.setDeptName("组织");
        SysDeptVo root = new SysDeptVo();
        root.setDeptId(1L);
        root.setParentId(0L);
        root.setDeptName("总部");
        root.setOrderNum(1);
        root.setStatus(SystemConstants.NORMAL);
        SysDeptVo child = new SysDeptVo();
        child.setDeptId(2L);
        child.setParentId(1L);
        child.setDeptName("研发部");
        child.setOrderNum(1);
        child.setStatus(SystemConstants.NORMAL);
        when(sysDeptMapper.selectDeptList(any())).thenReturn(List.of(root, child));

        List<Tree<Long>> trees = service.selectDeptTreeList(bo);

        assertEquals(1, trees.size());
        assertEquals(1L, trees.get(0).getId());
        assertEquals(1, trees.get(0).getChildren().size());
        assertEquals(2L, trees.get(0).getChildren().get(0).getId());
    }

    @Test
    @DisplayName("selectDeptById: should return null when dept not found")
    void selectDeptByIdShouldReturnNullWhenDeptNotFound() {
        SysDeptServiceImpl service = newService();
        when(sysDeptMapper.selectVoById(99L)).thenReturn(null);

        SysDeptVo result = service.selectDeptById(99L);

        assertNull(result);
    }

    @Test
    @DisplayName("selectDeptByIds/selectDeptsByList: should delegate and return mapped values")
    void selectDeptByIdsAndSelectDeptsByListShouldReturnExpectedValues() {
        SysDeptServiceImpl service = newService();
        SysDeptVo deptA = deptVo(7L, "研发中心", 100L);
        SysDeptVo deptB = deptVo(8L, "测试中心", 101L);
        when(sysDeptMapper.selectDeptList(any())).thenReturn(List.of(deptA)).thenReturn(List.of(deptA, deptB));

        List<SysDeptVo> byIds = service.selectDeptByIds(List.of(7L));
        List<DeptDTO> dtos = service.selectDeptsByList();

        assertEquals(1, byIds.size());
        assertEquals("研发中心", byIds.get(0).getDeptName());
        assertEquals(2, dtos.size());
        assertEquals(7L, dtos.get(0).getDeptId());
        assertEquals("测试中心", dtos.get(1).getDeptName());
    }

    @Test
    @DisplayName("selectNormalChildrenDeptById/selectDeptNamesByIds: should delegate and build map")
    void selectNormalChildrenDeptByIdAndSelectDeptNamesByIdsShouldWork() {
        SysDeptServiceImpl service = newService();
        SysDept deptA = new SysDept();
        deptA.setDeptId(1L);
        deptA.setDeptName("总部");
        SysDept deptB = new SysDept();
        deptB.setDeptId(2L);
        deptB.setDeptName("研发");
        when(sysDeptMapper.selectCount(any())).thenReturn(3L);
        when(sysDeptMapper.selectList(any())).thenReturn(List.of(deptA, deptB));

        long children = service.selectNormalChildrenDeptById(1L);
        Map<Long, String> names = service.selectDeptNamesByIds(List.of(1L, 2L));
        Map<Long, String> empty = service.selectDeptNamesByIds(List.of());

        assertEquals(3L, children);
        assertEquals(2, names.size());
        assertEquals("总部", names.get(1L));
        assertTrue(empty.isEmpty());
    }

    @Test
    @DisplayName("selectDeptListByRoleId: should read strict flag and query mapper")
    void selectDeptListByRoleIdShouldReadStrictFlagAndQueryMapper() {
        SysDeptServiceImpl service = newService();
        SysRole role = new SysRole();
        role.setRoleId(3L);
        role.setDeptCheckStrictly(true);
        when(sysRoleMapper.selectById(3L)).thenReturn(role);
        when(sysDeptMapper.selectDeptListByRoleId(3L, true)).thenReturn(List.of(1L, 2L));

        List<Long> deptIds = service.selectDeptListByRoleId(3L);

        assertEquals(List.of(1L, 2L), deptIds);
    }

    @Test
    @DisplayName("selectDeptNameByIds/selectDeptLeaderById: should batch names and keep leader cache proxy")
    void selectDeptNameByIdsShouldBatchNamesAndLeaderShouldUseCacheProxy() {
        SysDeptServiceImpl service = spy(newService());
        SysDeptVo deptA = deptVo(1L, "研发中心", 100L);
        SysDeptVo deptC = deptVo(3L, "测试中心", 101L);
        when(sysDeptMapper.selectVoList(any())).thenReturn(List.of(deptC, deptA));

        assertEquals("研发中心,测试中心", service.selectDeptNameByIds("1,2,3"));
        verify(sysDeptMapper).selectVoList(any());
        verify(service, never()).selectDeptById(anyLong());

        doReturn(deptVo(1L, "研发中心", 100L)).when(service).selectDeptById(1L);
        try (MockedStatic<SpringUtils> springUtils = mockStatic(SpringUtils.class)) {
            springUtils.when(() -> SpringUtils.getAopProxy(service)).thenReturn(service);

            assertEquals(100L, service.selectDeptLeaderById(1L));
        }
    }

    @Test
    @DisplayName("checkDeptDataScope: should throw when user has no dept scope")
    void checkDeptDataScopeShouldThrowWhenNoDeptScope() {
        SysDeptServiceImpl service = newService();
        when(sysDeptMapper.countDeptById(30L)).thenReturn(0L);

        ServiceException ex;
        try (MockedStatic<LoginUserContext> loginHelper = mockStatic(LoginUserContext.class)) {
            loginHelper.when(LoginUserContext::isSuperAdmin).thenReturn(false);
            ex = assertThrows(ServiceException.class, () -> service.checkDeptDataScope(30L));
        }

        assertTrue(ex.getMessage().contains("没有权限访问部门数据"));
    }

    @Test
    @DisplayName("checkDeptDataScope: should pass when deptId is null")
    void checkDeptDataScopeShouldPassWhenDeptIdIsNull() {
        SysDeptServiceImpl service = newService();

        assertDoesNotThrow(() -> service.checkDeptDataScope(null));
    }

    @Test
    @DisplayName("insertDept: should throw when parent dept is disabled")
    void insertDeptShouldThrowWhenParentDeptDisabled() {
        SysDeptServiceImpl service = newService();
        SysDeptBo bo = new SysDeptBo();
        bo.setParentId(10L);
        SysDept parent = new SysDept();
        parent.setDeptId(10L);
        parent.setStatus(SystemConstants.DISABLE);
        when(sysDeptMapper.selectById(10L)).thenReturn(parent);

        ServiceException ex = assertThrows(ServiceException.class, () -> service.insertDept(bo));

        assertTrue(ex.getMessage().contains("部门停用，不允许新增"));
    }

    @Test
    @DisplayName("hasChildByDeptId/checkDeptExistUser: should delegate to mapper exists")
    void hasChildAndCheckDeptExistUserShouldDelegateToMapperExists() {
        SysDeptServiceImpl service = newService();
        when(sysDeptMapper.exists(any())).thenReturn(true);
        when(sysUserMapper.exists(any())).thenReturn(true);

        assertTrue(service.hasChildByDeptId(1L));
        assertTrue(service.checkDeptExistUser(1L));
    }

    @Test
    @DisplayName("buildDeptTreeSelect: should return empty list for empty input")
    void buildDeptTreeSelectShouldReturnEmptyList() {
        SysDeptServiceImpl service = newService();

        List<Tree<Long>> trees = service.buildDeptTreeSelect(List.of());

        assertNotNull(trees);
        assertTrue(trees.isEmpty());
    }

    @Test
    @DisplayName("buildDeptTreeSelect: should build one root with one child")
    void buildDeptTreeSelectShouldBuildTree() {
        SysDeptServiceImpl service = newService();
        SysDeptVo root = new SysDeptVo();
        root.setDeptId(1L);
        root.setParentId(0L);
        root.setDeptName("root");
        root.setOrderNum(1);
        root.setStatus("0");
        SysDeptVo child = new SysDeptVo();
        child.setDeptId(2L);
        child.setParentId(1L);
        child.setDeptName("child");
        child.setOrderNum(1);
        child.setStatus("0");

        List<Tree<Long>> trees = service.buildDeptTreeSelect(List.of(root, child));

        assertEquals(1, trees.size());
        assertEquals(1, trees.get(0).getId());
        assertNotNull(trees.get(0).getChildren());
        assertEquals(1, trees.get(0).getChildren().size());
    }

    @Test
    @DisplayName("checkDeptNameUnique: should return false when same name exists")
    void checkDeptNameUniqueShouldReturnFalseWhenExists() {
        SysDeptServiceImpl service = newService();
        SysDeptBo bo = new SysDeptBo();
        bo.setDeptName("研发部");
        bo.setParentId(0L);
        when(sysDeptMapper.exists(any())).thenReturn(true);

        boolean unique = service.checkDeptNameUnique(bo);

        assertFalse(unique);
    }

    @Test
    @DisplayName("updateDept: should throw when target dept does not exist")
    void updateDeptShouldThrowWhenTargetDeptDoesNotExist() {
        SysDeptServiceImpl service = newService();
        SysDeptBo bo = new SysDeptBo();
        bo.setDeptId(10L);
        bo.setParentId(1L);
        bo.setStatus(SystemConstants.NORMAL);
        SysDept converted = new SysDept();
        converted.setDeptId(10L);
        converted.setParentId(1L);
        converted.setStatus(SystemConstants.NORMAL);
        when(sysDeptMapper.selectById(10L)).thenReturn(null);

        try (MockedStatic<MapstructUtils> mapstructUtils = mockStatic(MapstructUtils.class)) {
            mapstructUtils.when(() -> MapstructUtils.convert(bo, SysDept.class)).thenReturn(converted);

            ServiceException ex = assertThrows(ServiceException.class, () -> service.updateDept(bo));

            assertTrue(ex.getMessage().contains("部门不存在"));
        }
    }

    @Test
    @DisplayName("updateDept: should update children ancestors when parent changed")
    void updateDeptShouldUpdateChildrenAncestorsAndEnableParentChainWhenParentChanged() throws Exception {
        SysDeptServiceImpl service = spy(newService());
        doNothing().when(service).checkDeptDataScope(2L);

        SysDeptBo bo = new SysDeptBo();
        bo.setDeptId(10L);
        bo.setParentId(2L);
        bo.setStatus("1");

        SysDept converted = new SysDept();
        converted.setDeptId(10L);
        converted.setParentId(2L);
        converted.setStatus("1");

        SysDept oldDept = new SysDept();
        oldDept.setDeptId(10L);
        oldDept.setParentId(1L);
        oldDept.setAncestors("0,1");
        when(sysDeptMapper.selectById(10L)).thenReturn(oldDept);

        SysDept newParent = new SysDept();
        newParent.setDeptId(2L);
        newParent.setAncestors(SystemConstants.ROOT_DEPT_ANCESTORS);
        when(sysDeptMapper.selectById(2L)).thenReturn(newParent);

        SysDept child = new SysDept();
        child.setDeptId(11L);
        child.setAncestors("0,1,10");
        when(sysDeptMapper.selectList(any())).thenReturn(List.of(child));
        when(sysDeptMapper.updateBatchById(any())).thenReturn(true);
        when(sysDeptMapper.updateById(any(SysDept.class))).thenReturn(1);
        when(dynamicRoutingDataSource.determineDataSource()).thenReturn(dataSource);
        when(dataSource.getConnection()).thenReturn(connection);
        when(connection.getMetaData()).thenReturn(databaseMetaData);
        when(databaseMetaData.getDatabaseProductName()).thenReturn("MySQL");

        try (MockedStatic<MapstructUtils> mapstructUtils = mockStatic(MapstructUtils.class);
             MockedStatic<CacheUtils> cacheUtils = mockStatic(CacheUtils.class)) {
            mapstructUtils.when(() -> MapstructUtils.convert(bo, SysDept.class)).thenReturn(converted);

            int rows = service.updateDept(bo);

            assertEquals(1, rows);
            verify(service).checkDeptDataScope(2L);
            verify(sysDeptMapper).updateBatchById(any());
            verify(sysDeptMapper, never()).update(eq(null), any());
            cacheUtils.verify(() -> CacheUtils.evict(CacheNames.SYS_DEPT, 11L));
        }
    }

    @Test
    @DisplayName("updateDept: should keep ancestors when parent unchanged and skip parent status update")
    void updateDeptShouldKeepAncestorsWhenParentUnchangedAndSkipParentStatusUpdate() {
        SysDeptServiceImpl service = newService();
        SysDeptBo bo = new SysDeptBo();
        bo.setDeptId(10L);
        bo.setParentId(1L);
        bo.setStatus("1");

        SysDept converted = new SysDept();
        converted.setDeptId(10L);
        converted.setParentId(1L);
        converted.setStatus("1");

        SysDept oldDept = new SysDept();
        oldDept.setDeptId(10L);
        oldDept.setParentId(1L);
        oldDept.setAncestors("0,1");
        when(sysDeptMapper.selectById(10L)).thenReturn(oldDept);
        when(sysDeptMapper.updateById(any(SysDept.class))).thenReturn(1);

        try (MockedStatic<MapstructUtils> mapstructUtils = mockStatic(MapstructUtils.class)) {
            mapstructUtils.when(() -> MapstructUtils.convert(bo, SysDept.class)).thenReturn(converted);

            int rows = service.updateDept(bo);

            assertEquals(1, rows);
            assertEquals("0,1", converted.getAncestors());
            verify(sysDeptMapper, never()).update(eq(null), any());
        }
    }

    @Test
    @DisplayName("updateDept: should return zero when mapper updateById returns zero")
    void updateDeptShouldReturnZeroWhenMapperUpdateReturnsZero() {
        SysDeptServiceImpl service = newService();
        SysDeptBo bo = new SysDeptBo();
        bo.setDeptId(10L);
        bo.setParentId(1L);
        bo.setStatus("1");

        SysDept converted = new SysDept();
        converted.setDeptId(10L);
        converted.setParentId(1L);
        converted.setStatus("1");

        SysDept oldDept = new SysDept();
        oldDept.setDeptId(10L);
        oldDept.setParentId(1L);
        oldDept.setAncestors("0,1");
        when(sysDeptMapper.selectById(10L)).thenReturn(oldDept);
        when(sysDeptMapper.updateById(any(SysDept.class))).thenReturn(0);

        try (MockedStatic<MapstructUtils> mapstructUtils = mockStatic(MapstructUtils.class)) {
            mapstructUtils.when(() -> MapstructUtils.convert(bo, SysDept.class)).thenReturn(converted);

            int rows = service.updateDept(bo);

            assertEquals(0, rows);
        }
    }

    @Test
    @DisplayName("updateParentDeptStatusNormal(private): should update ancestor departments to normal")
    void updateParentDeptStatusNormalShouldUpdateAncestorsToNormal() {
        SysDeptServiceImpl service = newService();
        SysDept dept = new SysDept();
        dept.setAncestors("0,1,2");

        invokePrivateUpdateParentDeptStatusNormal(service, dept);

        verify(sysDeptMapper).update(eq(null), any());
    }

    @Test
    @DisplayName("deleteDeptById: should delegate to mapper deleteById")
    void deleteDeptByIdShouldDelegateToMapperDeleteById() {
        SysDeptServiceImpl service = newService();
        when(sysDeptMapper.deleteById(88L)).thenReturn(1);

        int rows = service.deleteDeptById(88L);

        assertEquals(1, rows);
        verify(sysDeptMapper).deleteById(88L);
    }

    private SysDeptServiceImpl newService() {
        return new SysDeptServiceImpl(sysDeptMapper, sysRoleMapper, sysUserMapper);
    }

    private static void invokePrivateUpdateParentDeptStatusNormal(SysDeptServiceImpl service, SysDept dept) {
        try {
            Method method = SysDeptServiceImpl.class.getDeclaredMethod("updateParentDeptStatusNormal", SysDept.class);
            method.setAccessible(true);
            method.invoke(service, dept);
        } catch (InvocationTargetException ex) {
            Throwable cause = ex.getCause();
            if (cause instanceof RuntimeException runtimeException) {
                throw runtimeException;
            }
            throw new RuntimeException(cause);
        } catch (ReflectiveOperationException ex) {
            throw new RuntimeException(ex);
        }
    }

    private static SysDeptVo deptVo(Long deptId, String deptName, Long leader) {
        SysDeptVo vo = new SysDeptVo();
        vo.setDeptId(deptId);
        vo.setDeptName(deptName);
        vo.setLeader(leader);
        return vo;
    }
}
