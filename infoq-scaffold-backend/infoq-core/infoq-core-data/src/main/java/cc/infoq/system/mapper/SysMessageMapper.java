package cc.infoq.system.mapper;

import cc.infoq.common.mybatis.core.mapper.BaseMapperPlus;
import cc.infoq.system.domain.entity.SysMessage;
import org.apache.ibatis.annotations.Param;

import java.util.Date;

public interface SysMessageMapper extends BaseMapperPlus<SysMessage, SysMessage> {

    int deleteExpiredWithoutRecipients(@Param("expiredBefore") Date expiredBefore);
}
