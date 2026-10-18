package cc.infoq.system.service.impl;

import cc.infoq.common.constant.CacheNames;
import cc.infoq.common.exception.ServiceException;
import cc.infoq.common.mybatis.core.page.PageQuery;
import cc.infoq.common.mybatis.core.page.TableDataInfo;
import cc.infoq.common.redis.utils.CacheUtils;
import cc.infoq.common.utils.MapstructUtils;
import cc.infoq.common.utils.StringUtils;
import cc.infoq.system.domain.bo.SysDictDataBo;
import cc.infoq.system.domain.entity.SysDictData;
import cc.infoq.system.domain.vo.SysDictDataVo;
import cc.infoq.system.mapper.SysDictDataMapper;
import cc.infoq.system.service.SysDictDataService;
import cn.hutool.core.util.ObjectUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.AllArgsConstructor;
import org.springframework.cache.annotation.CachePut;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 字典 业务层处理
 *
 * @author Pontus
 */
@AllArgsConstructor
@Service
public class SysDictDataServiceImpl implements SysDictDataService {

    private final SysDictDataMapper sysDictDataMapper;

    /**
     * 分页查询字典数据列表
     *
     * @param dictData  查询条件
     * @param pageQuery 分页参数
     * @return 字典数据分页列表
     */
    @Override
    public TableDataInfo<SysDictDataVo> selectPageDictDataList(SysDictDataBo dictData, PageQuery pageQuery) {
        LambdaQueryWrapper<SysDictData> lqw = buildQueryWrapper(dictData);
        Page<SysDictDataVo> page = sysDictDataMapper.selectVoPage(pageQuery.build(), lqw);
        return TableDataInfo.build(page);
    }

    /**
     * 根据条件分页查询字典数据
     *
     * @param dictData 字典数据信息
     * @return 字典数据集合信息
     */
    @Override
    public List<SysDictDataVo> selectDictDataList(SysDictDataBo dictData) {
        LambdaQueryWrapper<SysDictData> lqw = buildQueryWrapper(dictData);
        return sysDictDataMapper.selectVoList(lqw);
    }

    private LambdaQueryWrapper<SysDictData> buildQueryWrapper(SysDictDataBo bo) {
        LambdaQueryWrapper<SysDictData> lqw = Wrappers.lambdaQuery();
        lqw.eq(bo.getDictSort() != null, SysDictData::getDictSort, bo.getDictSort());
        lqw.like(StringUtils.isNotBlank(bo.getDictLabel()), SysDictData::getDictLabel, bo.getDictLabel());
        lqw.eq(StringUtils.isNotBlank(bo.getDictType()), SysDictData::getDictType, bo.getDictType());
        lqw.orderByAsc(SysDictData::getDictSort, SysDictData::getDictCode);
        return lqw;
    }

    /**
     * 根据字典类型和字典键值查询字典数据信息
     *
     * @param dictType  字典类型
     * @param dictValue 字典键值
     * @return 字典标签
     */
    @Override
    public String selectDictLabel(String dictType, String dictValue) {
        return sysDictDataMapper.selectOne(new LambdaQueryWrapper<SysDictData>()
                .select(SysDictData::getDictLabel)
                .eq(SysDictData::getDictType, dictType)
                .eq(SysDictData::getDictValue, dictValue))
            .getDictLabel();
    }

    /**
     * 根据字典数据ID查询信息
     *
     * @param dictCode 字典数据ID
     * @return 字典数据
     */
    @Override
    public SysDictDataVo selectDictDataById(Long dictCode) {
        return sysDictDataMapper.selectVoById(dictCode);
    }

    /**
     * 批量删除字典数据信息
     *
     * @param dictCodes 需要删除的字典数据ID
     */
    @Override
    public void deleteDictDataByIds(List<Long> dictCodes) {
        List<SysDictData> list = sysDictDataMapper.selectByIds(dictCodes);
        sysDictDataMapper.deleteByIds(dictCodes);
        list.forEach(x -> CacheUtils.evict(CacheNames.SYS_DICT, x.getDictType()));
    }

    /**
     * 新增保存字典数据信息
     *
     * @param bo 字典数据信息
     * @return 结果
     */
    @CachePut(cacheNames = CacheNames.SYS_DICT, key = "#bo.dictType")
    @Override
    public List<SysDictDataVo> insertDictData(SysDictDataBo bo) {
        SysDictData data = MapstructUtils.convert(bo, SysDictData.class);
        int row = sysDictDataMapper.insert(data);
        if (row > 0) {
            return sysDictDataMapper.selectDictDataByType(data.getDictType());
        }
        throw new ServiceException("操作失败");
    }

    /**
     * 修改保存字典数据信息
     *
     * @param bo 字典数据信息
     * @return 结果
     */
    @CachePut(cacheNames = CacheNames.SYS_DICT, key = "#bo.dictType")
    @Override
    public List<SysDictDataVo> updateDictData(SysDictDataBo bo) {
        SysDictData data = MapstructUtils.convert(bo, SysDictData.class);
        int row = sysDictDataMapper.updateById(data);
        if (row > 0) {
            return sysDictDataMapper.selectDictDataByType(data.getDictType());
        }
        throw new ServiceException("操作失败");
    }

    /**
     * 校验字典键值是否唯一
     *
     * @param dict 字典数据
     * @return 结果
     */
    @Override
    public boolean checkDictDataUnique(SysDictDataBo dict) {
        boolean exist = sysDictDataMapper.exists(new LambdaQueryWrapper<SysDictData>()
            .eq(SysDictData::getDictType, dict.getDictType())
            .eq(SysDictData::getDictValue, dict.getDictValue())
            .ne(ObjectUtil.isNotNull(dict.getDictCode()), SysDictData::getDictCode, dict.getDictCode()));
        return !exist;
    }

}
