package cc.infoq.system.mapper.xml;

import cc.infoq.system.mapper.SysOauthIdentityMapper;
import cc.infoq.system.mapper.support.MapperXmlIT;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@MapperXmlIT
class SysOauthIdentityMapperXmlIntegrationTest {

    @Autowired
    private SysOauthIdentityMapper sysOauthIdentityMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void deleteByUserIdsPhysicallyShouldRemoveRowsIncludingLogicallyDeletedOnes() {
        int rows = sysOauthIdentityMapper.deleteByUserIdsPhysically(List.of(501L, 502L));

        // 逻辑删除行也必须物理清除，否则唯一索引会永久占用第三方账号
        assertThat(rows).isEqualTo(2);
        List<Long> remaining = jdbcTemplate.queryForList("select identity_id from sys_oauth_identity order by identity_id", Long.class);
        assertThat(remaining).containsExactly(702L);
    }
}
