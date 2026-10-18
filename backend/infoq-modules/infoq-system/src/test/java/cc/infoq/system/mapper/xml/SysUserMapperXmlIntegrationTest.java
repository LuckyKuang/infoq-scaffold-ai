package cc.infoq.system.mapper.xml;

import cc.infoq.system.domain.bo.SysUserBo;
import cc.infoq.system.domain.entity.SysUser;
import cc.infoq.system.domain.vo.SysUserExportVo;
import cc.infoq.system.domain.vo.SysUserVo;
import cc.infoq.system.mapper.SysUserMapper;
import cc.infoq.system.mapper.support.MapperXmlIT;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import org.junit.jupiter.api.Test;
import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@MapperXmlIT
class SysUserMapperXmlIntegrationTest {

    @Autowired
    private SysUserMapper sysUserMapper;

    @Autowired
    private SqlSessionTemplate sqlSessionTemplate;

    @Test
    void selectUserCustomSqlMethodsShouldApplyWrapperConditions() {
        QueryWrapper<SysUser> allocated = Wrappers.query();
        allocated.eq("u.del_flag", "0")
            .eq("r.role_id", 10L)
            .orderByAsc("u.user_id");
        List<SysUserVo> allocatedRows = sqlSessionTemplate.selectList(
            "cc.infoq.system.mapper.SysUserMapper.selectAllocatedList",
            Map.of("ew", allocated)
        );
        assertThat(allocatedRows).extracting(SysUserVo::getUserId).containsExactly(501L);

        QueryWrapper<SysUser> unallocated = Wrappers.query();
        unallocated.eq("u.del_flag", "0")
            .and(w -> w.ne("r.role_id", 10L).or().isNull("r.role_id"))
            .notIn("u.user_id", List.of(501L))
            .orderByAsc("u.user_id");
        List<SysUserVo> unallocatedRows = sqlSessionTemplate.selectList(
            "cc.infoq.system.mapper.SysUserMapper.selectUnallocatedList",
            Map.of("ew", unallocated)
        );
        assertThat(unallocatedRows).extracting(SysUserVo::getUserId).containsExactly(502L, 503L);

        SysUserBo user = new SysUserBo();
        user.setUserName("ali");
        List<SysUserExportVo> exports = sysUserMapper.selectUserExportList(user, List.of(101L), Wrappers.query());
        assertThat(exports).hasSize(1);
        assertThat(exports.get(0).getUserId()).isEqualTo(501L);
        assertThat(exports.get(0).getDeptName()).isEqualTo("ChildDeptA");
        assertThat(exports.get(0).getLeaderName()).isEqualTo("alice");
    }
}
