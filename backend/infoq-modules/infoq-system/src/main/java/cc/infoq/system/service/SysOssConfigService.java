package cc.infoq.system.service;

import cc.infoq.common.mybatis.core.page.PageQuery;
import cc.infoq.common.mybatis.core.page.TableDataInfo;
import cc.infoq.system.domain.bo.SysOssConfigBo;
import cc.infoq.system.domain.vo.SysOssConfigVo;

import java.util.Collection;

/**
 * 对象存储配置Service接口
 *
 * @author Pontus
 */
public interface SysOssConfigService {

    /**
     * 初始化OSS配置
     */
    void init();

    /**
     * 查询单个
     */
    SysOssConfigVo queryById(Long ossConfigId);

    /**
     * 查询列表
     */
    TableDataInfo<SysOssConfigVo> queryPageList(SysOssConfigBo bo, PageQuery pageQuery);

    /**
     * 根据新增业务对象插入对象存储配置
     *
     * @param bo 对象存储配置新增业务对象
     * @return 结果
     */
    Boolean insertByBo(SysOssConfigBo bo);

    /**
     * 根据编辑业务对象修改对象存储配置
     *
     * @param bo 对象存储配置编辑业务对象
     * @return 结果
     */
    Boolean updateByBo(SysOssConfigBo bo);

    /**
     * 校验并删除数据
     *
     * @param ids     主键集合
     * @param isValid 是否校验,true-删除前校验,false-不校验
     * @return 结果
     */
    Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid);

    /**
     * 启用停用状态
     */
    int updateOssConfigStatus(SysOssConfigBo bo);

}
