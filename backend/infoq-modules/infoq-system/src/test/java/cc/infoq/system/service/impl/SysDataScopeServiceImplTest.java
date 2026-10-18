package cc.infoq.system.service.impl;

import cc.infoq.system.domain.entity.SysRoleDept;
import cc.infoq.system.mapper.SysDeptMapper;
import cc.infoq.system.mapper.SysRoleDeptMapper;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import org.apache.ibatis.builder.MapperBuilderAssistant;
import org.apache.ibatis.session.Configuration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@Tag("dev")
class SysDataScopeServiceImplTest {

    @Mock
    private SysRoleDeptMapper sysRoleDeptMapper;
    @Mock
    private SysDeptMapper sysDeptMapper;

    @BeforeEach
    void initTableInfoCache() {
        if (TableInfoHelper.getTableInfo(SysRoleDept.class) == null) {
            TableInfoHelper.initTableInfo(new MapperBuilderAssistant(new Configuration(), "sysRoleDeptMapper"), SysRoleDept.class);
        }
    }

    @Test
    @DisplayName("getRoleCustom: should return -1 when roleId is null")
    void getRoleCustomShouldReturnMinusOneWhenRoleIdNull() {
        SysDataScopeServiceImpl service = new SysDataScopeServiceImpl(sysRoleDeptMapper, sysDeptMapper);

        assertEquals("-1", service.getRoleCustom(null));
    }

    @Test
    @DisplayName("getDeptAndChild: should return -1 when deptId is null")
    void getDeptAndChildShouldReturnMinusOneWhenDeptIdNull() {
        SysDataScopeServiceImpl service = new SysDataScopeServiceImpl(sysRoleDeptMapper, sysDeptMapper);

        assertEquals("-1", service.getDeptAndChild(null));
    }

    @Test
    @DisplayName("getDeptAndChild: should join dept ids when mapper returns children")
    void getDeptAndChildShouldJoinDeptIdsWhenMapperReturnsChildren() {
        SysDataScopeServiceImpl service = new SysDataScopeServiceImpl(sysRoleDeptMapper, sysDeptMapper);
        when(sysDeptMapper.selectDeptAndChildById(10L)).thenReturn(java.util.List.of(10L, 11L, 12L));

        assertEquals("10,11,12", service.getDeptAndChild(10L));
    }

    @Test
    @DisplayName("getDeptAndChild: should return -1 when mapper returns empty list")
    void getDeptAndChildShouldReturnMinusOneWhenMapperReturnsEmptyList() {
        SysDataScopeServiceImpl service = new SysDataScopeServiceImpl(sysRoleDeptMapper, sysDeptMapper);
        when(sysDeptMapper.selectDeptAndChildById(20L)).thenReturn(java.util.List.of());

        assertEquals("-1", service.getDeptAndChild(20L));
    }

    @Test
    @DisplayName("getRoleCustom: should join dept ids when role dept list exists")
    void getRoleCustomShouldJoinDeptIdsWhenRoleDeptExists() {
        SysDataScopeServiceImpl service = new SysDataScopeServiceImpl(sysRoleDeptMapper, sysDeptMapper);
        SysRoleDept roleDept1 = new SysRoleDept();
        roleDept1.setDeptId(10L);
        SysRoleDept roleDept2 = new SysRoleDept();
        roleDept2.setDeptId(11L);
        when(sysRoleDeptMapper.selectList(any())).thenReturn(java.util.List.of(roleDept1, roleDept2));

        assertEquals("10,11", service.getRoleCustom(8L));
    }
}
