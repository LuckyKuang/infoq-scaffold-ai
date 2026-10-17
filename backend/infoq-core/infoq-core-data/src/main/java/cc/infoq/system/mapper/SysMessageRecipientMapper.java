package cc.infoq.system.mapper;

import cc.infoq.common.mybatis.core.mapper.BaseMapperPlus;
import cc.infoq.system.domain.bo.SysMessageQueryBo;
import cc.infoq.system.domain.entity.SysMessageRecipient;
import cc.infoq.system.domain.vo.SysMessageRecipientVo;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.apache.ibatis.annotations.Param;

public interface SysMessageRecipientMapper extends BaseMapperPlus<SysMessageRecipient, SysMessageRecipient> {
    Page<SysMessageRecipientVo> selectMessagePage(@Param("page") Page<SysMessageRecipientVo> page,
                                                   @Param("userId") Long userId,
                                                   @Param("query") SysMessageQueryBo query);
}
