package cc.infoq.system.service;

import cc.infoq.common.mybatis.core.page.PageQuery;
import cc.infoq.common.mybatis.core.page.TableDataInfo;
import cc.infoq.system.domain.bo.SysConfigBo;
import cc.infoq.system.domain.bo.SysConfigReorderBo;
import cc.infoq.system.domain.vo.SysConfigPanelVo;
import cc.infoq.system.domain.vo.SysConfigVo;

import java.util.List;

/**
 * 参数配置 服务层
 *
 * @author Pontus
 */
public interface SysConfigService {

    /**
     * 分页查询参数配置列表
     *
     * @param config    查询条件
     * @param pageQuery 分页参数
     * @return 参数配置分页列表
     */
    TableDataInfo<SysConfigVo> selectPageConfigList(SysConfigBo config, PageQuery pageQuery);

    /**
     * 查询参数配置信息
     *
     * @param configId 参数配置ID
     * @return 参数配置信息
     */
    SysConfigVo selectConfigById(Long configId);

    /**
     * 根据键名查询参数配置信息
     *
     * @param configKey 参数键名
     * @return 参数键值
     */
    String selectConfigByKey(String configKey);

    /**
     * 获取注册开关
     * @return true开启，false关闭
     */
    boolean selectRegisterEnabled();

    /**
     * 获取邀请码注册开关
     *
     * @return true开启，false关闭
     */
    boolean selectInviteRegisterEnabled();

    /**
     * 获取忘记密码开关
     *
     * @return true 开启，false 关闭
     */
    boolean selectForgotPasswordEnabled();

    /**
     * 查询参数配置列表
     *
     * @param config 参数配置信息
     * @return 参数配置集合
     */
    List<SysConfigVo> selectConfigList(SysConfigBo config);

    /**
     * 查询参数配置面板
     *
     * @return 分组后的配置面板
     */
    SysConfigPanelVo selectConfigPanel();

    /**
     * 新增参数配置
     *
     * @param bo 参数配置信息
     * @return 结果
     */
    String insertConfig(SysConfigBo bo);

    /**
     * 修改参数配置
     *
     * @param bo 参数配置信息
     * @return 结果
     */
    String updateConfig(SysConfigBo bo);

    /**
     * 根据参数 key 恢复默认值
     *
     * @param configKey 参数 key
     * @return 恢复后的参数值
     */
    String resetConfigByKey(String configKey);

    /**
     * 批量调整配置分组与顺序
     *
     * @param rows 排序请求
     */
    void reorderConfigs(List<SysConfigReorderBo> rows);

    /**
     * 批量删除参数信息
     *
     * @param configIds 需要删除的参数ID
     */
    void deleteConfigByIds(List<Long> configIds);

    /**
     * 重置参数缓存数据
     */
    void resetConfigCache();

    /**
     * 校验参数键名是否唯一
     *
     * @param config 参数信息
     * @return 结果
     */
    boolean checkConfigKeyUnique(SysConfigBo config);

}
