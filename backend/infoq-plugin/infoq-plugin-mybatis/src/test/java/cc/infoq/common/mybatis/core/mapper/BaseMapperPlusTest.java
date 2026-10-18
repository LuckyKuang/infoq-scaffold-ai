package cc.infoq.common.mybatis.core.mapper;

import cc.infoq.common.utils.MapstructUtils;
import cc.infoq.common.utils.SpringUtils;
import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.toolkit.Db;
import io.github.linpeilie.Converter;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.springframework.context.support.GenericApplicationContext;

import java.io.Serializable;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Answers.CALLS_REAL_METHODS;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.withSettings;

@Tag("dev")
class BaseMapperPlusTest {

    private static GenericApplicationContext context;
    private static Converter converter;

    @BeforeAll
    static void initSpringContext() {
        converter = mock(Converter.class);
        context = new GenericApplicationContext();
        context.registerBean(Converter.class, () -> converter);
        context.refresh();
        new SpringUtils().setApplicationContext(context);
    }

    @AfterAll
    static void closeContext() {
        if (context != null) {
            context.close();
        }
    }

    @Test
    void currentGenericClassMethodsShouldResolveFromMapperInterface() {
        DemoMapper mapper = mock(DemoMapper.class, withSettings().defaultAnswer(CALLS_REAL_METHODS));

        assertEquals(DemoEntity.class, mapper.currentModelClass());
        assertEquals(DemoVo.class, mapper.currentVoClass());
    }

    @Test
    void selectListAndBatchMethodsShouldDelegateToUnderlyingApis() {
        DemoMapper mapper = mock(DemoMapper.class, withSettings().defaultAnswer(CALLS_REAL_METHODS));
        List<DemoEntity> entities = List.of(new DemoEntity(1L, "n1"));
        when(mapper.selectList(anyQueryWrapper())).thenReturn(entities);

        assertEquals(entities, mapper.selectList());
        verify(mapper).selectList(anyQueryWrapper());

        try (MockedStatic<Db> db = org.mockito.Mockito.mockStatic(Db.class)) {
            db.when(() -> Db.saveBatch(entities)).thenReturn(true);
            db.when(() -> Db.updateBatchById(entities)).thenReturn(true);
            db.when(() -> Db.saveOrUpdateBatch(entities)).thenReturn(true);
            db.when(() -> Db.saveBatch(entities, 20)).thenReturn(true);
            db.when(() -> Db.updateBatchById(entities, 20)).thenReturn(true);
            db.when(() -> Db.saveOrUpdateBatch(entities, 20)).thenReturn(true);

            assertTrue(mapper.insertBatch(entities));
            assertTrue(mapper.updateBatchById(entities));
            assertTrue(mapper.insertOrUpdateBatch(entities));
            assertTrue(mapper.insertBatch(entities, 20));
            assertTrue(mapper.updateBatchById(entities, 20));
            assertTrue(mapper.insertOrUpdateBatch(entities, 20));
        }
    }

    @Test
    void voReadMethodsShouldConvertEntitiesThroughMapstruct() {
        DemoMapper mapper = mock(DemoMapper.class, withSettings().defaultAnswer(CALLS_REAL_METHODS));
        DemoEntity entity = new DemoEntity(10L, "alice");
        DemoVo vo = new DemoVo(10L, "alice");
        List<DemoEntity> entities = List.of(entity);
        List<DemoVo> vos = List.of(vo);
        QueryWrapper<DemoEntity> wrapper = new QueryWrapper<>();
        Page<DemoEntity> entityPage = new Page<>(1, 10, 1);

        when(mapper.currentVoClass()).thenReturn(DemoVo.class);
        when(mapper.selectById(10L)).thenReturn(entity);
        when(mapper.selectByIds(List.of(10L))).thenReturn(entities);
        when(mapper.selectByMap(Map.of("k", "v"))).thenReturn(entities);
        when(mapper.selectOne(wrapper, true)).thenReturn(entity);
        when(mapper.selectOne(wrapper, false)).thenReturn(entity);
        when(mapper.selectList(anyWrapper())).thenReturn(entities);
        when(mapper.selectList(anyPage(), eq(wrapper))).thenReturn(entities);
        when(converter.convert(entity, DemoVo.class)).thenReturn(vo);
        when(converter.convert(entities, DemoVo.class)).thenReturn(vos);

        assertSame(vo, mapper.selectVoById(10L));
        assertSame(vo, mapper.selectVoById(10L, DemoVo.class));

        assertEquals(vos, mapper.selectVoByIds(List.of(10L)));
        assertEquals(vos, mapper.selectVoByIds(List.of(10L), DemoVo.class));

        assertEquals(vos, mapper.selectVoByMap(Map.of("k", "v")));
        assertEquals(vos, mapper.selectVoByMap(Map.of("k", "v"), DemoVo.class));

        assertSame(vo, mapper.selectVoOne(wrapper));
        assertSame(vo, mapper.selectVoOne(wrapper, true));
        assertSame(vo, mapper.selectVoOne(wrapper, DemoVo.class));
        assertSame(vo, mapper.selectVoOne(wrapper, DemoVo.class, false));

        assertEquals(vos, mapper.selectVoList());
        assertEquals(vos, mapper.selectVoList(wrapper));
        assertEquals(vos, mapper.selectVoList(wrapper, DemoVo.class));

        Page<DemoVo> voPage = mapper.selectVoPage(entityPage, wrapper);
        assertEquals(1, voPage.getTotal());
        assertEquals(vos, voPage.getRecords());
    }

    @Test
    void voReadMethodsShouldReturnNullOrEmptyWhenEntityMissing() {
        DemoMapper mapper = mock(DemoMapper.class, withSettings().defaultAnswer(CALLS_REAL_METHODS));
        QueryWrapper<DemoEntity> wrapper = new QueryWrapper<>();
        Page<DemoEntity> entityPage = new Page<>(1, 10, 0);

        when(mapper.currentVoClass()).thenReturn(DemoVo.class);
        when(mapper.selectById(20L)).thenReturn(null);
        when(mapper.selectByIds(List.of(20L))).thenReturn(List.of());
        when(mapper.selectByMap(Map.of("k", "missing"))).thenReturn(List.of());
        when(mapper.selectOne(wrapper, true)).thenReturn(null);
        when(mapper.selectList(anyWrapper())).thenReturn(List.of());
        when(mapper.selectList(anyPage(), eq(wrapper))).thenReturn(List.of());

        assertNull(mapper.selectVoById(20L));
        assertTrue(mapper.selectVoByIds(List.of(20L)).isEmpty());
        assertTrue(mapper.selectVoByMap(Map.of("k", "missing")).isEmpty());
        assertNull(mapper.selectVoOne(wrapper));
        assertTrue(mapper.selectVoList(wrapper).isEmpty());
        assertTrue(mapper.selectVoPage(entityPage, wrapper).getRecords().isEmpty());
    }

    @Test
    void selectObjsShouldApplyMapperFunction() {
        DemoMapper mapper = mock(DemoMapper.class, withSettings().defaultAnswer(CALLS_REAL_METHODS));
        QueryWrapper<DemoEntity> wrapper = new QueryWrapper<>();
        when(mapper.<Object>selectObjs(wrapper)).thenReturn(List.of(1, 2, 3));

        List<String> values = mapper.selectObjs(wrapper, (Function<Object, String>) Object::toString);

        assertEquals(List.of("1", "2", "3"), values);
    }

    private interface DemoMapper extends BaseMapperPlus<DemoEntity, DemoVo> {
        @Override
        DemoEntity selectById(Serializable id);

        @Override
        List<DemoEntity> selectByIds(Collection<? extends Serializable> idList);

        @Override
        List<DemoEntity> selectByMap(Map<String, Object> columnMap);

        @Override
        DemoEntity selectOne(Wrapper<DemoEntity> queryWrapper, boolean throwEx);

        @Override
        List<DemoEntity> selectList(Wrapper<DemoEntity> queryWrapper);

        @Override
        List<DemoEntity> selectList(IPage<DemoEntity> page, Wrapper<DemoEntity> queryWrapper);
    }

    private static class DemoEntity {
        private final Long id;
        private final String name;

        private DemoEntity(Long id, String name) {
            this.id = id;
            this.name = name;
        }
    }

    private static class DemoVo {
        private final Long id;
        private final String name;

        private DemoVo(Long id, String name) {
            this.id = id;
            this.name = name;
        }
    }

    private static <T> QueryWrapper<T> anyQueryWrapper() {
        return any();
    }

    private static <T> Wrapper<T> anyWrapper() {
        return any();
    }

    private static <T> IPage<T> anyPage() {
        return any();
    }
}
