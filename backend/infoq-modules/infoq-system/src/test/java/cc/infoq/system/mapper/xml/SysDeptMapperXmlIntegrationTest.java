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
}
