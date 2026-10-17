package cc.infoq.system.service;

import cc.infoq.common.mybatis.core.page.PageQuery;
import cc.infoq.common.mybatis.core.page.TableDataInfo;
import cc.infoq.system.domain.bo.SysJobBo;
import cc.infoq.system.domain.vo.SysJobVo;

import java.util.List;

/**
 * 定时任务 Service 接口
 *
 * @author Pontus
 */
public interface SysJobService {

    TableDataInfo<SysJobVo> queryPageList(SysJobBo bo, PageQuery pageQuery);

    List<SysJobVo> queryList(SysJobBo bo);

    SysJobVo queryById(Long jobId);

    boolean insertByBo(SysJobBo bo);

    boolean updateByBo(SysJobBo bo);

    boolean deleteByIds(Long[] jobIds);

    boolean changeStatus(SysJobBo bo);

    boolean runNow(Long jobId);

    List<String> listHandlerKeys();

    void init();
}
