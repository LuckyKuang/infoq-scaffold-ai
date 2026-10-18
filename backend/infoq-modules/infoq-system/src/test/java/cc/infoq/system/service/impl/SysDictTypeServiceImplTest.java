package cc.infoq.system.service.impl;

import cc.infoq.common.constant.CacheNames;
import cc.infoq.common.domain.dto.DictDataDTO;
import cc.infoq.common.domain.dto.DictTypeDTO;
import cc.infoq.common.exception.ServiceException;
import cc.infoq.common.mybatis.core.page.PageQuery;
import cc.infoq.common.mybatis.core.page.TableDataInfo;
import cc.infoq.common.redis.utils.CacheUtils;
import cc.infoq.common.utils.MapstructUtils;
import cc.infoq.common.utils.SpringUtils;
import cc.infoq.system.domain.bo.SysDictTypeBo;
import cc.infoq.system.domain.entity.SysDictData;
import cc.infoq.system.domain.entity.SysDictType;
import cc.infoq.system.domain.vo.SysDictDataVo;
import cc.infoq.system.domain.vo.SysDictTypeVo;
import cc.infoq.system.mapper.SysDictDataMapper;
import cc.infoq.system.mapper.SysDictTypeMapper;
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

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@Tag("dev")
class SysDictTypeServiceImplTest {

    @Mock
    private SysDictTypeMapper sysDictTypeMapper;
    @Mock
    private SysDictDataMapper sysDictDataMapper;

    private SysDictTypeServiceImpl service;

    @BeforeEach
    void setUp() {
        CacheManager cacheManager = mock(CacheManager.class);
        GenericApplicationContext context = new GenericApplicationContext();
        context.registerBean(Converter.class, () -> mock(Converter.class));
        context.registerBean(CacheManager.class, () -> cacheManager);
        context.refresh();
        new SpringUtils().setApplicationContext(context);
        TableInfoHelper.remove(SysDictType.class);
        TableInfoHelper.initTableInfo(new MapperBuilderAssistant(new Configuration(), ""), SysDictType.class);
        TableInfoHelper.remove(SysDictData.class);
        TableInfoHelper.initTableInfo(new MapperBuilderAssistant(new Configuration(), ""), SysDictData.class);
        service = new SysDictTypeServiceImpl(sysDictTypeMapper, sysDictDataMapper);
    }

    @Test
    @DisplayName("selectDictDataByType: should return null when no dict data found")
    void selectDictDataByTypeShouldReturnNullWhenEmpty() {
        when(sysDictDataMapper.selectDictDataByType("sys_x")).thenReturn(List.of());
        assertNull(service.selectDictDataByType("sys_x"));
    }

    @Test
    @DisplayName("selectDictDataByType: should return list when mapper has records")
    void selectDictDataByTypeShouldReturnListWhenPresent() {
        List<SysDictDataVo> records = List.of(dictDataVo("1", "启用"));
        when(sysDictDataMapper.selectDictDataByType("sys_status")).thenReturn(records);
        assertSame(records, service.selectDictDataByType("sys_status"));
    }

    @Test
    @DisplayName("checkDictTypeUnique: should return inverse of mapper exists result")
    void checkDictTypeUniqueShouldReflectExistsFlag() {
        SysDictTypeBo bo = new SysDictTypeBo();
        bo.setDictId(3L);
        bo.setDictType("sys_status");
        when(sysDictTypeMapper.exists(any())).thenReturn(true).thenReturn(false);

        assertEquals(false, service.checkDictTypeUnique(bo));
        assertEquals(true, service.checkDictTypeUnique(bo));
    }

    @Test
    @DisplayName("selectPageDictTypeList/selectDictTypeList: should build query and return mapper results")
    void selectPageAndListShouldReturnMapperResults() {
        SysDictTypeBo bo = new SysDictTypeBo();
        bo.setDictName("状态");
        bo.setDictType("sys_status");
        bo.getParams().put("beginTime", "2026-03-01 00:00:00");
        bo.getParams().put("endTime", "2026-03-31 23:59:59");

        Page<SysDictTypeVo> page = new Page<>(1, 10);
        page.setTotal(1);
        page.setRecords(List.of(dictTypeVo(1L, "sys_status", "状态")));
        when(sysDictTypeMapper.selectVoPage(any(), any())).thenReturn(page);
        when(sysDictTypeMapper.selectVoList(any())).thenReturn(List.of(dictTypeVo(2L, "sys_gender", "性别")));

        TableDataInfo<SysDictTypeVo> pageResult = service.selectPageDictTypeList(bo, new PageQuery(1, 10));
        List<SysDictTypeVo> listResult = service.selectDictTypeList(bo);

        assertEquals(1L, pageResult.getTotal());
        assertEquals("sys_status", pageResult.getRows().get(0).getDictType());
        assertEquals(1, listResult.size());
        assertEquals("性别", listResult.get(0).getDictName());
    }

    @Test
    @DisplayName("selectDictTypeAll/selectDictTypeById/selectDictTypeByType: should delegate to mapper")
    void selectDictTypeQueryMethodsShouldDelegateToMapper() {
        SysDictTypeVo typeAll = dictTypeVo(3L, "sys_scene", "场景");
        SysDictTypeVo typeById = dictTypeVo(4L, "sys_flag", "标记");
        SysDictTypeVo typeByType = dictTypeVo(5L, "sys_level", "级别");
        when(sysDictTypeMapper.selectVoList()).thenReturn(List.of(typeAll));
        when(sysDictTypeMapper.selectVoById(4L)).thenReturn(typeById);
        when(sysDictTypeMapper.selectVoOne(any())).thenReturn(typeByType);

        assertEquals(1, service.selectDictTypeAll().size());
        assertEquals("sys_flag", service.selectDictTypeById(4L).getDictType());
        assertEquals("级别", service.selectDictTypeByType("sys_level").getDictName());
    }

    @Test
    @DisplayName("getDictLabel/getDictValue/getAllDictByDictType: should map dict labels and values via aop proxy")
    void dictLookupMethodsShouldUseAopProxyData() {
        SysDictTypeServiceImpl spyService = spy(service);
        List<SysDictDataVo> data = List.of(
            dictDataVo("1", "男"),
            dictDataVo("2", "女")
        );
        doReturn(data).when(spyService).selectDictDataByType("gender");

        try (MockedStatic<SpringUtils> springUtils = mockStatic(SpringUtils.class)) {
            springUtils.when(() -> SpringUtils.getAopProxy(spyService)).thenReturn(spyService);

            assertEquals("男,女", spyService.getDictLabel("gender", "1,2", ","));
            assertEquals("1,2", spyService.getDictValue("gender", "男,女", ","));
            Map<String, String> all = spyService.getAllDictByDictType("gender");
            assertEquals(List.of("1", "2"), new ArrayList<>(all.keySet()));
            assertEquals("女", all.get("2"));
        }
    }

    @Test
    @DisplayName("getDictType/getDictData: should convert proxy data to dto")
    void getDictTypeAndDictDataShouldConvertToDto() {
        SysDictTypeServiceImpl spyService = spy(service);
        SysDictTypeVo typeVo = dictTypeVo(8L, "sys_mode", "模式");
        List<SysDictDataVo> dataVos = List.of(
            dictDataVo("A", "自动"),
            dictDataVo("M", "手动")
        );
        doReturn(typeVo).when(spyService).selectDictTypeByType("sys_mode");
        doReturn(dataVos).when(spyService).selectDictDataByType("sys_mode");

        try (MockedStatic<SpringUtils> springUtils = mockStatic(SpringUtils.class)) {
            springUtils.when(() -> SpringUtils.getAopProxy(spyService)).thenReturn(spyService);

            DictTypeDTO dictType = spyService.getDictType("sys_mode");
            List<DictDataDTO> dictData = spyService.getDictData("sys_mode");

            assertNotNull(dictType);
            assertEquals("sys_mode", dictType.getDictType());
            assertEquals(2, dictData.size());
            assertEquals("自动", dictData.get(0).getDictLabel());
        }
    }

    @Test
    @DisplayName("getDictLabel/getDictValue: should support single token without separator split")
    void dictLookupSingleTokenShouldReturnMappedValue() {
        SysDictTypeServiceImpl spyService = spy(service);
        List<SysDictDataVo> data = List.of(
            dictDataVo("1", "开启"),
            dictDataVo("0", "关闭")
        );
        doReturn(data).when(spyService).selectDictDataByType("switch");

        try (MockedStatic<SpringUtils> springUtils = mockStatic(SpringUtils.class)) {
            springUtils.when(() -> SpringUtils.getAopProxy(spyService)).thenReturn(spyService);

            assertEquals("开启", spyService.getDictLabel("switch", "1", ","));
            assertEquals("0", spyService.getDictValue("switch", "关闭", ","));
        }
    }

    @Test
    @DisplayName("resetDictCache: should clear dict and dict-type namespaces")
    void resetDictCacheShouldClearNamespaces() {
        try (MockedStatic<CacheUtils> cacheUtils = mockStatic(CacheUtils.class)) {
            service.resetDictCache();

            cacheUtils.verify(() -> CacheUtils.clear(CacheNames.SYS_DICT));
            cacheUtils.verify(() -> CacheUtils.clear(CacheNames.SYS_DICT_TYPE));
        }
    }

    @Test
    @DisplayName("insertDictType: should convert bo and return empty list when insert succeeds")
    void insertDictTypeShouldReturnEmptyListWhenInsertSucceeds() {
        SysDictTypeBo bo = new SysDictTypeBo();
        bo.setDictType("sys_scene");
        SysDictType converted = new SysDictType();
        converted.setDictType("sys_scene");

        when(sysDictTypeMapper.insert(converted)).thenReturn(1);

        try (MockedStatic<MapstructUtils> mapstructUtils = mockStatic(MapstructUtils.class)) {
            mapstructUtils.when(() -> MapstructUtils.convert(bo, SysDictType.class)).thenReturn(converted);

            List<SysDictDataVo> result = service.insertDictType(bo);

            assertNotNull(result);
            assertEquals(0, result.size());
        }
    }

    @Test
    @DisplayName("insertDictType: should throw when mapper insert fails")
    void insertDictTypeShouldThrowWhenInsertFails() {
        SysDictTypeBo bo = new SysDictTypeBo();
        bo.setDictType("sys_scene");
        SysDictType converted = new SysDictType();
        converted.setDictType("sys_scene");

        when(sysDictTypeMapper.insert(converted)).thenReturn(0);

        try (MockedStatic<MapstructUtils> mapstructUtils = mockStatic(MapstructUtils.class)) {
            mapstructUtils.when(() -> MapstructUtils.convert(bo, SysDictType.class)).thenReturn(converted);

            assertThrows(ServiceException.class, () -> service.insertDictType(bo));
        }
    }

    @Test
    @DisplayName("updateDictType: should migrate dictType, evict old cache and return new type data")
    void updateDictTypeShouldMigrateTypeAndReturnData() {
        SysDictTypeBo bo = new SysDictTypeBo();
        bo.setDictId(9L);
        bo.setDictType("sys_mode_new");
        SysDictType converted = new SysDictType();
        converted.setDictId(9L);
        converted.setDictType("sys_mode_new");
        SysDictType old = new SysDictType();
        old.setDictId(9L);
        old.setDictType("sys_mode_old");
        List<SysDictDataVo> expected = List.of(dictDataVo("A", "自动"));

        when(sysDictTypeMapper.selectById(9L)).thenReturn(old);
        when(sysDictDataMapper.update(any(), any())).thenReturn(1);
        when(sysDictTypeMapper.updateById(converted)).thenReturn(1);
        when(sysDictDataMapper.selectDictDataByType("sys_mode_new")).thenReturn(expected);

        try (MockedStatic<MapstructUtils> mapstructUtils = mockStatic(MapstructUtils.class);
             MockedStatic<CacheUtils> cacheUtils = mockStatic(CacheUtils.class)) {
            mapstructUtils.when(() -> MapstructUtils.convert(bo, SysDictType.class)).thenReturn(converted);

            List<SysDictDataVo> result = service.updateDictType(bo);

            assertSame(expected, result);
            cacheUtils.verify(() -> CacheUtils.evict(CacheNames.SYS_DICT, "sys_mode_old"));
            cacheUtils.verify(() -> CacheUtils.evict(CacheNames.SYS_DICT_TYPE, "sys_mode_old"));
        }
    }

    @Test
    @DisplayName("updateDictType: should throw when update fails")
    void updateDictTypeShouldThrowWhenUpdateFails() {
        SysDictTypeBo bo = new SysDictTypeBo();
        bo.setDictId(10L);
        bo.setDictType("sys_mode_new");
        SysDictType converted = new SysDictType();
        converted.setDictId(10L);
        converted.setDictType("sys_mode_new");
        SysDictType old = new SysDictType();
        old.setDictId(10L);
        old.setDictType("sys_mode_old");

        when(sysDictTypeMapper.selectById(10L)).thenReturn(old);
        when(sysDictDataMapper.update(any(), any())).thenReturn(1);
        when(sysDictTypeMapper.updateById(converted)).thenReturn(0);

        try (MockedStatic<MapstructUtils> mapstructUtils = mockStatic(MapstructUtils.class)) {
            mapstructUtils.when(() -> MapstructUtils.convert(bo, SysDictType.class)).thenReturn(converted);

            assertThrows(ServiceException.class, () -> service.updateDictType(bo));
        }
    }

    @Test
    @DisplayName("deleteDictTypeByIds: should delete and evict caches when no data assigned")
    void deleteDictTypeByIdsShouldDeleteAndEvictWhenNotAssigned() {
        SysDictType typeA = new SysDictType();
        typeA.setDictId(1L);
        typeA.setDictType("sys_a");
        typeA.setDictName("A");
        SysDictType typeB = new SysDictType();
        typeB.setDictId(2L);
        typeB.setDictType("sys_b");
        typeB.setDictName("B");
        when(sysDictTypeMapper.selectByIds(List.of(1L, 2L))).thenReturn(List.of(typeA, typeB));
        when(sysDictDataMapper.selectList(any())).thenReturn(List.of());

        try (MockedStatic<CacheUtils> cacheUtils = mockStatic(CacheUtils.class)) {
            service.deleteDictTypeByIds(List.of(1L, 2L));

            verify(sysDictDataMapper).selectList(any());
            verify(sysDictTypeMapper).deleteByIds(List.of(1L, 2L));
            cacheUtils.verify(() -> CacheUtils.evict(CacheNames.SYS_DICT, "sys_a"));
            cacheUtils.verify(() -> CacheUtils.evict(CacheNames.SYS_DICT_TYPE, "sys_a"));
            cacheUtils.verify(() -> CacheUtils.evict(CacheNames.SYS_DICT, "sys_b"));
            cacheUtils.verify(() -> CacheUtils.evict(CacheNames.SYS_DICT_TYPE, "sys_b"));
        }
    }

    @Test
    @DisplayName("deleteDictTypeByIds: should throw when dict data already assigned")
    void deleteDictTypeByIdsShouldThrowWhenAssigned() {
        SysDictType typeA = new SysDictType();
        typeA.setDictId(1L);
        typeA.setDictType("sys_a");
        typeA.setDictName("类型A");
        when(sysDictTypeMapper.selectByIds(List.of(1L))).thenReturn(List.of(typeA));
        SysDictData data = new SysDictData();
        data.setDictType("sys_a");
        when(sysDictDataMapper.selectList(any())).thenReturn(List.of(data));

        assertThrows(ServiceException.class, () -> service.deleteDictTypeByIds(List.of(1L)));
    }

    private static SysDictTypeVo dictTypeVo(Long id, String type, String name) {
        SysDictTypeVo vo = new SysDictTypeVo();
        vo.setDictId(id);
        vo.setDictType(type);
        vo.setDictName(name);
        return vo;
    }

    private static SysDictDataVo dictDataVo(String value, String label) {
        SysDictDataVo vo = new SysDictDataVo();
        vo.setDictValue(value);
        vo.setDictLabel(label);
        return vo;
    }
}
