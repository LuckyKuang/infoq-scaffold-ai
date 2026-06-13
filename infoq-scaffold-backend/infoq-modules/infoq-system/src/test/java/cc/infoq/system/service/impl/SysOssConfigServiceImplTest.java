package cc.infoq.system.service.impl;

import cc.infoq.common.exception.ServiceException;
import cc.infoq.common.json.utils.JsonUtils;
import cc.infoq.common.oss.constant.OssConstant;
import cc.infoq.common.redis.utils.CacheUtils;
import cc.infoq.common.redis.utils.RedisUtils;
import cc.infoq.common.utils.MapstructUtils;
import cc.infoq.common.utils.SpringUtils;
import cc.infoq.system.domain.bo.SysOssConfigBo;
import cc.infoq.system.domain.entity.SysOssConfig;
import cc.infoq.system.domain.vo.SysOssConfigVo;
import cc.infoq.system.mapper.SysOssConfigMapper;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import org.redisson.api.RBucket;
import org.redisson.api.RedissonClient;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.context.support.GenericApplicationContext;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@Tag("dev")
class SysOssConfigServiceImplTest {

    @Mock
    private SysOssConfigMapper sysOssConfigMapper;
    @Mock
    private RBucket<Object> bucket;

    private SysOssConfigServiceImpl service;

    @BeforeEach
    void setUp() {
        CacheManager cacheManager = mock(CacheManager.class);
        Cache cache = mock(Cache.class);
        RedissonClient redissonClient = mock(RedissonClient.class);
        GenericApplicationContext context = new GenericApplicationContext();
        context.registerBean(ObjectMapper.class, () -> new ObjectMapper());
        context.registerBean(Converter.class, () -> mock(Converter.class));
        context.registerBean(CacheManager.class, () -> cacheManager);
        context.registerBean(RedissonClient.class, () -> redissonClient);
        context.refresh();
        new SpringUtils().setApplicationContext(context);
        lenient().when(cacheManager.getCache(anyString())).thenReturn(cache);
        lenient().when(redissonClient.getBucket(anyString())).thenReturn(bucket);
        TableInfoHelper.remove(SysOssConfig.class);
        TableInfoHelper.initTableInfo(new MapperBuilderAssistant(new Configuration(), ""), SysOssConfig.class);
        service = new SysOssConfigServiceImpl(sysOssConfigMapper);
    }

    @Test
    @DisplayName("deleteWithValidByIds: should reject system built-in config ids")
    void deleteWithValidByIdsShouldRejectSystemIds() {
        assertThrows(ServiceException.class, () -> service.deleteWithValidByIds(List.of(1L), true));
    }

    @Test
    @DisplayName("queryById: should delegate to mapper")
    void queryByIdShouldDelegateToMapper() {
        SysOssConfigVo vo = new SysOssConfigVo();
        vo.setOssConfigId(10L);
        vo.setConfigKey("local");
        when(sysOssConfigMapper.selectVoById(10L)).thenReturn(vo);

        SysOssConfigVo result = service.queryById(10L);

        assertEquals(10L, result.getOssConfigId());
        assertEquals("local", result.getConfigKey());
    }

    @Test
    @DisplayName("queryPageList: should build wrapper and return page rows")
    void queryPageListShouldBuildWrapperAndReturnRows() {
        SysOssConfigBo bo = new SysOssConfigBo();
        bo.setConfigKey("local");
        bo.setBucketName("bucket");
        bo.setStatus("0");
        SysOssConfigVo vo = new SysOssConfigVo();
        vo.setOssConfigId(1L);
        Page<SysOssConfigVo> page = new Page<>();
        page.setRecords(List.of(vo));
        page.setTotal(1);
        when(sysOssConfigMapper.selectVoPage(any(), any())).thenReturn(page);

        var result = service.queryPageList(bo, new cc.infoq.common.mybatis.core.page.PageQuery(10, 1));

        assertEquals(1, result.getTotal());
        assertEquals(1, result.getRows().size());
        assertEquals(1L, result.getRows().get(0).getOssConfigId());
    }

    @Test
    @DisplayName("deleteWithValidByIds: should return false when mapper deletes zero rows")
    void deleteWithValidByIdsShouldReturnFalseWhenNoRowsDeleted() {
        SysOssConfig config = new SysOssConfig();
        config.setOssConfigId(9L);
        config.setConfigKey("custom");
        when(sysOssConfigMapper.selectByIds(List.of(9L))).thenReturn(List.of(config));
        when(sysOssConfigMapper.deleteByIds(List.of(9L))).thenReturn(0);

        Boolean result = service.deleteWithValidByIds(List.of(9L), false);

        assertFalse(result);
    }

    @Test
    @DisplayName("deleteWithValidByIds: should evict cache after successful delete")
    void deleteWithValidByIdsShouldEvictCacheWhenDeleteSuccess() {
        SysOssConfig config1 = new SysOssConfig();
        config1.setOssConfigId(9L);
        config1.setConfigKey("custom-1");
        SysOssConfig config2 = new SysOssConfig();
        config2.setOssConfigId(10L);
        config2.setConfigKey("custom-2");
        when(sysOssConfigMapper.selectByIds(List.of(9L, 10L))).thenReturn(List.of(config1, config2));
        when(sysOssConfigMapper.deleteByIds(List.of(9L, 10L))).thenReturn(2);

        try (MockedStatic<CacheUtils> cacheUtils = org.mockito.Mockito.mockStatic(CacheUtils.class)) {
            Boolean result = service.deleteWithValidByIds(List.of(9L, 10L), false);

            assertTrue(result);
            cacheUtils.verify(() -> CacheUtils.evict(anyString(), org.mockito.ArgumentMatchers.eq("custom-1")));
            cacheUtils.verify(() -> CacheUtils.evict(anyString(), org.mockito.ArgumentMatchers.eq("custom-2")));
        }
    }

    @Test
    @DisplayName("init: should load all configs and write cache payloads")
    void initShouldLoadAllConfigsAndWriteCachePayloads() {
        SysOssConfig defaultConfig = new SysOssConfig();
        defaultConfig.setOssConfigId(8L);
        defaultConfig.setConfigKey("obs-default");
        defaultConfig.setStatus("0");
        SysOssConfig nonDefaultConfig = new SysOssConfig();
        nonDefaultConfig.setOssConfigId(9L);
        nonDefaultConfig.setConfigKey("obs-alt");
        nonDefaultConfig.setStatus("1");
        when(sysOssConfigMapper.selectList()).thenReturn(List.of(defaultConfig, nonDefaultConfig));

        try (MockedStatic<JsonUtils> jsonUtils = org.mockito.Mockito.mockStatic(JsonUtils.class);
             MockedStatic<CacheUtils> cacheUtils = org.mockito.Mockito.mockStatic(CacheUtils.class);
             MockedStatic<RedisUtils> redisUtils = org.mockito.Mockito.mockStatic(RedisUtils.class)) {
            jsonUtils.when(() -> JsonUtils.toJsonString(defaultConfig)).thenReturn("{\"configKey\":\"obs-default\"}");
            jsonUtils.when(() -> JsonUtils.toJsonString(nonDefaultConfig)).thenReturn("{\"configKey\":\"obs-alt\"}");

            service.init();

            verify(sysOssConfigMapper).selectList();
            redisUtils.verify(() -> RedisUtils.setCacheObject(OssConstant.DEFAULT_CONFIG_KEY, "obs-default"));
            cacheUtils.verify(() -> CacheUtils.put(anyString(), eq("obs-default"), eq("{\"configKey\":\"obs-default\"}")));
            cacheUtils.verify(() -> CacheUtils.put(anyString(), eq("obs-alt"), eq("{\"configKey\":\"obs-alt\"}")));
        }
    }

    @Test
    @DisplayName("insertByBo: should validate uniqueness, insert and cache db payload")
    void insertByBoShouldInsertAndCachePayload() {
        SysOssConfigBo bo = new SysOssConfigBo();
        bo.setConfigKey("local");
        SysOssConfig converted = new SysOssConfig();
        converted.setOssConfigId(12L);
        converted.setConfigKey("local");
        SysOssConfig persisted = new SysOssConfig();
        persisted.setOssConfigId(12L);
        persisted.setConfigKey("local");

        when(sysOssConfigMapper.selectOne(any())).thenReturn(null);
        when(sysOssConfigMapper.insert(converted)).thenReturn(1);
        when(sysOssConfigMapper.selectById(12L)).thenReturn(persisted);

        try (MockedStatic<MapstructUtils> mapstructUtils = org.mockito.Mockito.mockStatic(MapstructUtils.class);
             MockedStatic<JsonUtils> jsonUtils = org.mockito.Mockito.mockStatic(JsonUtils.class);
             MockedStatic<CacheUtils> cacheUtils = org.mockito.Mockito.mockStatic(CacheUtils.class)) {
            mapstructUtils.when(() -> MapstructUtils.convert(bo, SysOssConfig.class)).thenReturn(converted);
            jsonUtils.when(() -> JsonUtils.toJsonString(persisted)).thenReturn("{\"configKey\":\"local\"}");

            Boolean result = service.insertByBo(bo);

            assertTrue(result);
            cacheUtils.verify(() -> CacheUtils.put(anyString(), eq("local"), eq("{\"configKey\":\"local\"}")));
        }
    }

    @Test
    @DisplayName("insertByBo: should throw when configKey is duplicated")
    void insertByBoShouldThrowWhenConfigKeyDuplicated() {
        SysOssConfigBo bo = new SysOssConfigBo();
        bo.setConfigKey("dup-key");
        SysOssConfig converted = new SysOssConfig();
        converted.setOssConfigId(9L);
        converted.setConfigKey("dup-key");
        SysOssConfig existed = new SysOssConfig();
        existed.setOssConfigId(99L);
        existed.setConfigKey("dup-key");

        when(sysOssConfigMapper.selectOne(any())).thenReturn(existed);

        try (MockedStatic<MapstructUtils> mapstructUtils = org.mockito.Mockito.mockStatic(MapstructUtils.class)) {
            mapstructUtils.when(() -> MapstructUtils.convert(bo, SysOssConfig.class)).thenReturn(converted);

            assertThrows(ServiceException.class, () -> service.insertByBo(bo));
        }
    }

    @Test
    @DisplayName("updateByBo: should update and refresh cache payload")
    void updateByBoShouldUpdateAndRefreshCache() {
        SysOssConfigBo bo = new SysOssConfigBo();
        bo.setOssConfigId(21L);
        bo.setConfigKey("obs");
        SysOssConfig converted = new SysOssConfig();
        converted.setOssConfigId(21L);
        converted.setConfigKey("obs");
        converted.setPrefix(null);
        converted.setRegion(null);
        converted.setExt1(null);
        converted.setRemark(null);
        SysOssConfig refreshed = new SysOssConfig();
        refreshed.setOssConfigId(21L);
        refreshed.setConfigKey("obs");

        when(sysOssConfigMapper.selectOne(any())).thenReturn(null);
        when(sysOssConfigMapper.update(eq(converted), any())).thenReturn(1);
        when(sysOssConfigMapper.selectById(21L)).thenReturn(refreshed);

        try (MockedStatic<MapstructUtils> mapstructUtils = org.mockito.Mockito.mockStatic(MapstructUtils.class);
             MockedStatic<JsonUtils> jsonUtils = org.mockito.Mockito.mockStatic(JsonUtils.class);
             MockedStatic<CacheUtils> cacheUtils = org.mockito.Mockito.mockStatic(CacheUtils.class)) {
            mapstructUtils.when(() -> MapstructUtils.convert(bo, SysOssConfig.class)).thenReturn(converted);
            jsonUtils.when(() -> JsonUtils.toJsonString(refreshed)).thenReturn("{\"configKey\":\"obs\"}");

            Boolean result = service.updateByBo(bo);

            assertTrue(result);
            cacheUtils.verify(() -> CacheUtils.put(anyString(), eq("obs"), eq("{\"configKey\":\"obs\"}")));
        }
    }

    @Test
    @DisplayName("updateOssConfigStatus: should switch default config and cache default key")
    void updateOssConfigStatusShouldSetDefaultConfigKeyInRedis() {
        SysOssConfigBo bo = new SysOssConfigBo();
        bo.setOssConfigId(2L);
        bo.setConfigKey("aliyun");
        SysOssConfig converted = new SysOssConfig();
        converted.setOssConfigId(2L);
        converted.setConfigKey("aliyun");

        when(sysOssConfigMapper.update(org.mockito.ArgumentMatchers.isNull(), any())).thenReturn(1);
        when(sysOssConfigMapper.updateById(converted)).thenReturn(1);

        try (MockedStatic<MapstructUtils> mapstructUtils = org.mockito.Mockito.mockStatic(MapstructUtils.class);
             MockedStatic<RedisUtils> redisUtils = org.mockito.Mockito.mockStatic(RedisUtils.class)) {
            mapstructUtils.when(() -> MapstructUtils.convert(bo, SysOssConfig.class)).thenReturn(converted);

            int rows = service.updateOssConfigStatus(bo);

            assertEquals(2, rows);
            redisUtils.verify(() -> RedisUtils.setCacheObject(OssConstant.DEFAULT_CONFIG_KEY, "aliyun"));
        }
    }
}
