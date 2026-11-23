package cc.infoq.system.mapper;

import cc.infoq.common.mybatis.core.mapper.BaseMapperPlus;
import cc.infoq.system.domain.entity.SysOauthIdentity;
import cc.infoq.system.domain.vo.SysOauthIdentityVo;
import org.apache.ibatis.annotations.Param;

import java.util.Collection;

/**
 * OAuth 身份绑定 Mapper
 */
public interface SysOauthIdentityMapper extends BaseMapperPlus<SysOauthIdentity, SysOauthIdentityVo> {

    /**
     * 按用户物理删除全部 OAuth 身份绑定（含已逻辑删除行），用于用户删除时释放第三方账号唯一索引
     *
     * @param userIds 用户ID集合，不能为空
     * @return 删除行数
     */
    int deleteByUserIdsPhysically(@Param("userIds") Collection<Long> userIds);
}
