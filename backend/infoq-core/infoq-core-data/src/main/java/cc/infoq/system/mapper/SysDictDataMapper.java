package cc.infoq.system.mapper;

import cc.infoq.common.mybatis.core.mapper.BaseMapperPlus;
import cc.infoq.system.domain.entity.SysDictData;
import cc.infoq.system.domain.vo.SysDictDataVo;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 字典表 数据层
 *
 * @author Pontus
 */
public interface SysDictDataMapper extends BaseMapperPlus<SysDictData, SysDictDataVo> {

    /**
     * 根据字典类型查询字典数据列表
     *
     * @param dictType 字典类型
     * @return 符合条件的字典数据列表
     */
    List<SysDictDataVo> selectDictDataByType(@Param("dictType") String dictType);
}
