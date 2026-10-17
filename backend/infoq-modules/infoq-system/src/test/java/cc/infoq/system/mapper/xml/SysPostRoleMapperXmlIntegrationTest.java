package cc.infoq.system.mapper.xml;

import cc.infoq.system.domain.vo.SysPostVo;
import cc.infoq.system.domain.vo.SysRoleVo;
import cc.infoq.system.mapper.SysPostMapper;
import cc.infoq.system.mapper.SysRoleMapper;
import cc.infoq.system.mapper.support.MapperXmlIT;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@MapperXmlIT
class SysPostRoleMapperXmlIntegrationTest {

    @Autowired
    private SysPostMapper sysPostMapper;

    @Autowired
    private SysRoleMapper sysRoleMapper;

    @Test
    void selectPostsAndRolesByUserIdShouldWork() {
        List<SysPostVo> posts = sysPostMapper.selectPostsByUserId(501L);
        List<SysRoleVo> roles = sysRoleMapper.selectRolesByUserId(501L);

        assertThat(posts).extracting(SysPostVo::getPostId).containsExactly(300L);
        assertThat(roles).extracting(SysRoleVo::getRoleId).containsExactly(10L);
    }
}
