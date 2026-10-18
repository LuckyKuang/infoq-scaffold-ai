package cc.infoq.system.service.impl;

import cc.infoq.common.exception.ServiceException;
import cc.infoq.common.constant.CacheNames;
import cc.infoq.common.mybatis.core.page.PageQuery;
import cc.infoq.common.mybatis.core.page.TableDataInfo;
import cc.infoq.common.redis.utils.CacheUtils;
import cc.infoq.common.utils.MapstructUtils;
import cc.infoq.common.utils.SpringUtils;
import cc.infoq.system.domain.bo.SysDictDataBo;
import cc.infoq.system.domain.entity.SysDictData;
import cc.infoq.system.domain.vo.SysDictDataVo;
import cc.infoq.system.mapper.SysDictDataMapper;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import io.github.linpeilie.Converter;
import org.apache.ibatis.builder.MapperBuilderAssistant;
import org.apache.ibatis.session.Configuration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.cache.CacheManager;
import org.springframework.context.support.GenericApplicationContext;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
@Tag("dev")
class SysDictDataServiceImplTest {

    @Mock
    private SysDictDataMapper sysDictDataMapper;

    private SysDictDataServiceImpl service;

    @BeforeEach
    void setUp() {
        GenericApplicationContext context = new GenericApplicationContext();
        context.registerBean(Converter.class, () -> mock(Converter.class));
        context.registerBean(CacheManager.class, () -> mock(CacheManager.class));
        context.refresh();
        new SpringUtils().setApplicationContext(context);
        if (TableInfoHelper.getTableInfo(SysDictData.class) == null) {
            TableInfoHelper.initTableInfo(new MapperBuilderAssistant(new Configuration(), ""), SysDictData.class);
        }
        service = new SysDictDataServiceImpl(sysDictDataMapper);
    }

    @Test
    @DisplayName("selectPageDictDataList: should return mapper page records")
    void selectPageDictDataListShouldReturnMapperPageRecords() {
        SysDictDataBo bo = new SysDictDataBo();
        bo.setDictSort(2);
        bo.setDictLabel("启用");
        bo.setDictType("sys_status");
        Page<SysDictDataVo> page = new Page<>(1, 10);
        page.setTotal(1);
        page.setRecords(List.of(dictDataVo("1", "启用")));
        when(sysDictDataMapper.selectVoPage(any(), any())).thenReturn(page);

        TableDataInfo<SysDictDataVo> table = service.selectPageDictDataList(bo, new PageQuery(1, 10));

        assertEquals(1L, table.getTotal());
        assertEquals(1, table.getRows().size());
        assertEquals("启用", table.getRows().get(0).getDictLabel());
    }

    @Test
    @DisplayName("selectDictDataList: should return mapper list")
    void selectDictDataListShouldReturnMapperList() {
        SysDictDataBo bo = new SysDictDataBo();
        bo.setDictType("sys_status");
        List<SysDictDataVo> expected = List.of(dictDataVo("0", "停用"));
        when(sysDictDataMapper.selectVoList(any())).thenReturn(expected);

        List<SysDictDataVo> actual = service.selectDictDataList(bo);

        assertSame(expected, actual);
    }

    @Test
    @DisplayName("selectDictDataById: should return mapper value")
    void selectDictDataByIdShouldReturnMapperValue() {
        SysDictDataVo vo = dictDataVo("1", "正常");
        when(sysDictDataMapper.selectVoById(12L)).thenReturn(vo);

        assertSame(vo, service.selectDictDataById(12L));
    }

    @Test
    @DisplayName("selectDictLabel: should return label queried by type and value")
    void selectDictLabelShouldReturnLabelByTypeAndValue() {
        SysDictData data = new SysDictData();
        data.setDictType("sys_status");
        data.setDictValue("1");
        data.setDictLabel("正常");
        when(sysDictDataMapper.selectOne(any())).thenReturn(data);

        String label = service.selectDictLabel("sys_status", "1");

        assertEquals("正常", label);
    }

    @Test
    @DisplayName("checkDictDataUnique: should return false when same dict value exists")
    void checkDictDataUniqueShouldReturnFalseWhenExists() {
        SysDictDataBo bo = new SysDictDataBo();
        bo.setDictType("sys_yes_no");
        bo.setDictValue("Y");
        when(sysDictDataMapper.exists(any())).thenReturn(true);

        assertFalse(service.checkDictDataUnique(bo));
    }

    @Test
    @DisplayName("checkDictDataUnique: should return true when dict value does not exist")
    void checkDictDataUniqueShouldReturnTrueWhenAbsent() {
        SysDictDataBo bo = new SysDictDataBo();
        bo.setDictType("sys_yes_no");
        bo.setDictValue("N");
        when(sysDictDataMapper.exists(any())).thenReturn(false);

        assertTrue(service.checkDictDataUnique(bo));
    }

    @Test
    @DisplayName("insertDictData/updateDictData: should convert and return latest type list when persistence succeeds")
    void insertAndUpdateDictDataShouldConvertAndReturnTypeListWhenSuccess() {
        SysDictDataBo bo = new SysDictDataBo();
        bo.setDictType("sys_status");
        bo.setDictLabel("正常");
        SysDictData data = new SysDictData();
        data.setDictType("sys_status");
        List<SysDictDataVo> expected = List.of(dictDataVo("1", "正常"));
        when(sysDictDataMapper.insert(data)).thenReturn(1);
        when(sysDictDataMapper.updateById(data)).thenReturn(1);
        when(sysDictDataMapper.selectDictDataByType("sys_status")).thenReturn(expected);

        try (MockedStatic<MapstructUtils> mapstructUtils = mockStatic(MapstructUtils.class)) {
            mapstructUtils.when(() -> MapstructUtils.convert(bo, SysDictData.class)).thenReturn(data);

            List<SysDictDataVo> insertResult = service.insertDictData(bo);
            List<SysDictDataVo> updateResult = service.updateDictData(bo);

            assertSame(expected, insertResult);
            assertSame(expected, updateResult);
        }
    }

    @Test
    @DisplayName("insertDictData/updateDictData: should throw when persistence fails")
    void insertAndUpdateDictDataShouldThrowWhenPersistenceFails() {
        SysDictDataBo bo = new SysDictDataBo();
        bo.setDictType("sys_status");
        SysDictData data = new SysDictData();
        data.setDictType("sys_status");
        when(sysDictDataMapper.insert(data)).thenReturn(0);
        when(sysDictDataMapper.updateById(data)).thenReturn(0);

        try (MockedStatic<MapstructUtils> mapstructUtils = mockStatic(MapstructUtils.class)) {
            mapstructUtils.when(() -> MapstructUtils.convert(bo, SysDictData.class)).thenReturn(data);

            assertThrows(ServiceException.class, () -> service.insertDictData(bo));
            assertThrows(ServiceException.class, () -> service.updateDictData(bo));
        }
    }

    @Test
    @DisplayName("deleteDictDataByIds: should delete rows and evict dict cache for each type")
    void deleteDictDataByIdsShouldDeleteRowsAndEvictDictCacheForEachType() {
        SysDictData d1 = new SysDictData();
        d1.setDictType("sys_status");
        SysDictData d2 = new SysDictData();
        d2.setDictType("sys_yes_no");
        when(sysDictDataMapper.selectByIds(List.of(1L, 2L))).thenReturn(List.of(d1, d2));

        try (MockedStatic<CacheUtils> cacheUtils = mockStatic(CacheUtils.class)) {
            service.deleteDictDataByIds(List.of(1L, 2L));

            verify(sysDictDataMapper).deleteByIds(List.of(1L, 2L));
            cacheUtils.verify(() -> CacheUtils.evict(CacheNames.SYS_DICT, "sys_status"));
            cacheUtils.verify(() -> CacheUtils.evict(CacheNames.SYS_DICT, "sys_yes_no"));
        }
    }

    private static SysDictDataVo dictDataVo(String value, String label) {
        SysDictDataVo vo = new SysDictDataVo();
        vo.setDictValue(value);
        vo.setDictLabel(label);
        return vo;
    }
}
