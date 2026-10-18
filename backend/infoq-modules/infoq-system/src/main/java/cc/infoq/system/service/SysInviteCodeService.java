package cc.infoq.system.service;

import cc.infoq.common.mybatis.core.page.PageQuery;
import cc.infoq.common.mybatis.core.page.TableDataInfo;
import cc.infoq.system.domain.bo.SysInviteCodeBo;
import cc.infoq.system.domain.vo.SysInviteCodeVo;

import java.util.Collection;
import java.util.List;

/**
 * 邀请码服务
 *
 * @author Pontus
 */
public interface SysInviteCodeService {

    /**
     * 分页查询邀请码列表
     *
     * @param bo        查询条件
     * @param pageQuery 分页参数
     * @return 分页结果
     */
    TableDataInfo<SysInviteCodeVo> queryPageList(SysInviteCodeBo bo, PageQuery pageQuery);

    /**
     * 查询邀请码列表
     *
     * @param bo 查询条件
     * @return 邀请码列表
     */
    List<SysInviteCodeVo> queryList(SysInviteCodeBo bo);

    /**
     * 生成邀请码
     *
     * @param bo 生成参数
     * @return 是否成功
     */
    Boolean generateInviteCodes(SysInviteCodeBo bo);

    /**
     * 作废邀请码
     *
     * @param bo 作废参数
     * @return 是否成功
     */
    Boolean cancelInviteCode(SysInviteCodeBo bo);

    /**
     * 删除邀请码
     *
     * @param ids 邀请码ID列表
     * @return 是否成功
     */
    Boolean deleteWithValidByIds(Collection<Long> ids);

    /**
     * 校验邀请码是否可用
     *
     * @param inviteCode 邀请码
     */
    void validateInviteCodeAvailable(String inviteCode);

    /**
     * 消费邀请码
     *
     * @param inviteCode 邀请码
     * @param usedUserId 使用人ID
     */
    void consumeInviteCode(String inviteCode, Long usedUserId);
}
