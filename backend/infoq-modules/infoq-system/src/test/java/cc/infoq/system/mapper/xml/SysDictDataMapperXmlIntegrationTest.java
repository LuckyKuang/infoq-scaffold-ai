package cc.infoq.system.mapper.xml;

import cc.infoq.system.domain.vo.SysDictDataVo;
import cc.infoq.system.mapper.SysDictDataMapper;
import cc.infoq.system.mapper.support.MapperXmlIT;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@MapperXmlIT
class SysDictDataMapperXmlIntegrationTest {

    @Autowired
    private SysDictDataMapper sysDictDataMapper;

    @Test
    void selectDictDataByTypeShouldReturnSortedRows() {
        List<SysDictDataVo> rows = sysDictDataMapper.selectDictDataByType("sys_yes_no");

        assertThat(rows).hasSize(2);
        assertThat(rows).extracting(SysDictDataVo::getDictValue).containsExactly("Y", "N");
    }
}
