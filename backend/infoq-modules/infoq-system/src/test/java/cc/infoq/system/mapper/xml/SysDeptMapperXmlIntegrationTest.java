package cc.infoq.system.mapper.xml;

import cc.infoq.system.mapper.SysDeptMapper;
import cc.infoq.system.mapper.support.MapperXmlIT;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@MapperXmlIT
class SysDeptMapperXmlIntegrationTest {

    @Autowired
    private SysDeptMapper sysDeptMapper;

    @Test
    void selectDeptListByRoleIdShouldApplyStrictFlag() {
        List<Long> normal = sysDeptMapper.selectDeptListByRoleId(10L, false);
        List<Long> strict = sysDeptMapper.selectDeptListByRoleId(10L, true);

        assertThat(normal).containsExactly(100L, 101L);
        assertThat(strict).containsExactly(101L);
    }

    @Test
    void selectDeptListByRoleIdShouldIncludeDisabledRoleForEditTree() {
        // role 11 为停用角色：编辑角色时必须回显其已有自定义数据权限部门，否则保存会清空授权
        assertThat(sysDeptMapper.selectDeptListByRoleId(11L, false)).containsExactly(101L, 102L);
        assertThat(sysDeptMapper.selectDeptListByRoleId(11L, true)).containsExactly(101L, 102L);
    }
}
