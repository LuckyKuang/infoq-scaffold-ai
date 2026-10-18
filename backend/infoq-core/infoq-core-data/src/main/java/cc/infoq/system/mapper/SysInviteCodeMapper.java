package cc.infoq.system.mapper;

import cc.infoq.common.mybatis.core.mapper.BaseMapperPlus;
import cc.infoq.system.domain.bo.SysInviteCodeBo;
import cc.infoq.system.domain.entity.SysInviteCode;
import cc.infoq.system.domain.vo.SysInviteCodeVo;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.apache.ibatis.annotations.Param;

import java.util.Date;
import java.util.List;

/**
 * 邀请码数据层
 *
 * @author Pontus
 */
public interface SysInviteCodeMapper extends BaseMapperPlus<SysInviteCode, SysInviteCodeVo> {

    /**
     * 分页查询邀请码列表
     *
     * @param page 分页参数
     * @param bo   查询条件
     * @return 分页结果
     */
    Page<SysInviteCodeVo> selectPageInviteCodeList(@Param("page") Page<SysInviteCode> page,
                                                   @Param("bo") SysInviteCodeBo bo);

    /**
     * 查询邀请码列表
     *
     * @param bo 查询条件
     * @return 邀请码列表
     */
    List<SysInviteCodeVo> selectInviteCodeList(@Param("bo") SysInviteCodeBo bo);

    /**
     * 刷新过期状态
     *
     * @param now 当前时间
     * @return 更新行数
     */
    int expireInviteCodes(@Param("now") Date now);

    /**
     * 消费邀请码
     *
     * @param inviteCode 邀请码
     * @param usedUserId 使用人ID
     * @param usedTime   使用时间
     * @param now        当前时间
     * @return 更新行数
     */
    int consumeInviteCode(@Param("inviteCode") String inviteCode,
                          @Param("usedUserId") Long usedUserId,
                          @Param("usedTime") Date usedTime,
                          @Param("now") Date now);
}
