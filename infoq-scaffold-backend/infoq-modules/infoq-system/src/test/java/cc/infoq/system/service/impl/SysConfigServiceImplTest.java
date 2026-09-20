package cc.infoq.system.service.impl;

import cc.infoq.common.constant.CacheNames;
import cc.infoq.common.constant.SystemConstants;
import cc.infoq.common.exception.ServiceException;
import cc.infoq.common.redis.utils.CacheUtils;
import cc.infoq.common.security.auth.LoginUserContext;
import cc.infoq.common.security.auth.SecurityAuthorizationService;
import cc.infoq.common.utils.MapstructUtils;
import cc.infoq.common.utils.SpringUtils;
import cc.infoq.system.TableInfoTestInitializer;
import cc.infoq.system.domain.bo.SysConfigBo;
import cc.infoq.system.domain.entity.SysConfig;
import cc.infoq.system.domain.vo.SysConfigVo;
import cc.infoq.system.mapper.SysConfigMapper;
import cn.hutool.core.lang.Dict;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.linpeilie.Converter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.context.support.GenericApplicationContext;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@Tag("dev")
class SysConfigServiceImplTest {

    @Mock
    private SysConfigMapper sysConfigMapper;

    @Mock
    private SecurityAuthorizationService securityAuthorizationService;

    private CacheManager cacheManager;
    private Cache cache;
    private SysConfigServiceImpl service;

    @BeforeEach
    void setUp() {
        TableInfoTestInitializer.initSystemTableInfo();
        cacheManager = mock(CacheManager.class);
        cache = mock(Cache.class);
        GenericApplicationContext context = new GenericApplicationContext();
        context.registerBean(Converter.class, () -> mock(Converter.class));
        context.registerBean(ObjectMapper.class, () -> new ObjectMapper());
        context.registerBean(CacheManager.class, () -> cacheManager);
        context.refresh();
        new SpringUtils().setApplicationContext(context);
        lenient().when(cacheManager.getCache(anyString())).thenReturn(cache);
        service = new SysConfigServiceImpl(sysConfigMapper, securityAuthorizationService);
    }

    @Test
    @DisplayName("selectRegisterEnabled: should parse true from config value")
    void selectRegisterEnabledShouldParseTrue() {
        SysConfig config = new SysConfig();
        config.setConfigValue("true");
        when(sysConfigMapper.selectOne(any())).thenReturn(config);

        assertTrue(service.selectRegisterEnabled());
    }

    @Test
    @DisplayName("selectForgotPasswordEnabled: should parse true from config value")
    void selectForgotPasswordEnabledShouldParseTrue() {
        SysConfig config = new SysConfig();
        config.setConfigValue("true");
        when(sysConfigMapper.selectOne(any())).thenReturn(config);

        assertTrue(service.selectForgotPasswordEnabled());
    }

    @Test
    @DisplayName("selectPageConfigList: should return paged rows")
    void selectPageConfigListShouldReturnPagedRows() {
        SysConfigBo bo = new SysConfigBo();
        bo.setConfigName("name");
        bo.setConfigType("Y");
        bo.setConfigKey("key");
        bo.getParams().put("beginTime", "2026-03-01 00:00:00");
        bo.getParams().put("endTime", "2026-03-08 00:00:00");
        Page<SysConfigVo> page = new Page<>(1, 10);
        SysConfigVo vo = new SysConfigVo();
        vo.setConfigId(1L);
        page.setRecords(List.of(vo));
        page.setTotal(1L);
        when(sysConfigMapper.selectVoPage(any(), any())).thenReturn(page);

        var result = service.selectPageConfigList(bo, new cc.infoq.common.mybatis.core.page.PageQuery(10, 1));

        assertEquals(1L, result.getTotal());
        assertEquals(1, result.getRows().size());
    }

    @Test
    @DisplayName("selectConfigList: should delegate with built query wrapper")
    void selectConfigListShouldDelegateWithBuiltQueryWrapper() {
        SysConfigBo bo = new SysConfigBo();
        bo.setConfigKey("sys.key");
        when(sysConfigMapper.selectVoList(any())).thenReturn(List.of(new SysConfigVo()));

        List<SysConfigVo> result = service.selectConfigList(bo);

        assertEquals(1, result.size());
    }

    @Test
    @DisplayName("selectConfigById: should delegate to mapper")
    void selectConfigByIdShouldDelegateToMapper() {
        SysConfigVo vo = new SysConfigVo();
        vo.setConfigId(11L);
        when(sysConfigMapper.selectVoById(11L)).thenReturn(vo);

        SysConfigVo result = service.selectConfigById(11L);

        assertEquals(11L, result.getConfigId());
    }

    @Test
    @DisplayName("selectConfigByKey: should return empty string when key not found")
    void selectConfigByKeyShouldReturnEmptyWhenNotFound() {
        when(sysConfigMapper.selectOne(any())).thenReturn(null);

        String value = service.selectConfigByKey("missing");

        assertEquals("", value);
    }

    @Test
    @DisplayName("selectConfigPanel: should group configs and fallback unknown metadata")
    void selectConfigPanelShouldGroupAndFallbackMetadata() {
        SysConfig account = new SysConfig();
        account.setConfigId(5L);
        account.setConfigName("是否开启注册");
        account.setConfigKey(SystemConstants.ACCOUNT_REGISTER_CONFIG_KEY);
        account.setConfigValue("false");
        account.setConfigType(SystemConstants.YES);
        account.setValueType("switch");
        account.setDefaultValue("false");
        account.setGroupKey("account");
        account.setDisplayOrder(10);

        SysConfig unknown = new SysConfig();
        unknown.setConfigId(99L);
        unknown.setConfigName("历史配置");
        unknown.setConfigKey("sys.legacy");
        unknown.setConfigValue("v");
        unknown.setGroupKey("missing");

        when(sysConfigMapper.selectList(any())).thenReturn(List.of(account, unknown));

        var panel = service.selectConfigPanel();

        assertEquals(4, panel.getGroups().size());
        assertEquals("账号与登录", panel.getGroups().get(0).getGroupName());
        assertEquals(1, panel.getGroups().get(0).getItems().size());
        assertEquals("advanced", panel.getGroups().get(3).getItems().get(0).getGroupKey());
        assertEquals("text", panel.getGroups().get(3).getItems().get(0).getValueType());
    }

    @Test
    @DisplayName("selectConfigPanel: should mark normal config editable when user has edit permission")
    void selectConfigPanelShouldMarkNormalConfigEditableWhenUserHasEditPermission() {
        SysConfig config = new SysConfig();
        config.setConfigId(6L);
        config.setConfigName("系统模式");
        config.setConfigKey("sys.mode");
        config.setConfigValue("dev");
        config.setValueType("text");
        config.setGroupKey("advanced");
        config.setDisplayOrder(1);
        when(sysConfigMapper.selectList(any())).thenReturn(List.of(config));
        when(securityAuthorizationService.hasPermission("system:config:edit")).thenReturn(true);

        var panel = service.selectConfigPanel();

        var item = panel.getGroups().get(3).getItems().get(0);
        assertTrue(item.getEditable());
        assertNull(item.getEditableReason());
    }

    @Test
    @DisplayName("selectConfigPanel: should return non-editable when authentication is missing")
    void selectConfigPanelShouldReturnNonEditableWhenAuthenticationIsMissing() {
        SysConfig config = new SysConfig();
        config.setConfigId(7L);
        config.setConfigName("系统模式");
        config.setConfigKey("sys.mode");
        config.setConfigValue("dev");
        config.setValueType("text");
        config.setGroupKey("advanced");
        config.setDisplayOrder(1);
        when(sysConfigMapper.selectList(any())).thenReturn(List.of(config));
        when(securityAuthorizationService.hasPermission("system:config:edit"))
            .thenThrow(new AuthenticationCredentialsNotFoundException("missing"));

        var panel = service.selectConfigPanel();

        var item = panel.getGroups().get(3).getItems().get(0);
        assertFalse(item.getEditable());
        assertEquals("缺少 system:config:edit 权限", item.getEditableReason());
    }

    @Test
    @DisplayName("selectConfigPanel: should mark sensitive config non-editable for non-superadmin")
    void selectConfigPanelShouldMarkSensitiveConfigNonEditableForNonSuperadmin() {
        SysConfig config = new SysConfig();
        config.setConfigId(8L);
        config.setConfigName("是否开启注册");
        config.setConfigKey(SystemConstants.ACCOUNT_REGISTER_CONFIG_KEY);
        config.setConfigValue("false");
        config.setValueType("switch");
        config.setGroupKey("account");
        config.setDisplayOrder(1);
        when(sysConfigMapper.selectList(any())).thenReturn(List.of(config));
        when(securityAuthorizationService.hasPermission("system:config:edit")).thenReturn(true);

        try (MockedStatic<LoginUserContext> loginUserContext = mockStatic(LoginUserContext.class)) {
            loginUserContext.when(LoginUserContext::isSuperAdmin).thenReturn(false);

            var panel = service.selectConfigPanel();

            var item = panel.getGroups().get(0).getItems().get(0);
            assertFalse(item.getEditable());
            assertEquals("账号敏感配置仅超级管理员可编辑", item.getEditableReason());
        }
    }

    @Test
    @DisplayName("insertConfig: should return config value when insert succeeds")
    void insertConfigShouldReturnConfigValueWhenInsertSucceeds() {
        SysConfigBo bo = new SysConfigBo();
        bo.setConfigKey("k1");
        bo.setConfigValue("v1");
        SysConfig entity = new SysConfig();
        entity.setConfigKey("k1");
        entity.setConfigValue("v1");
        when(sysConfigMapper.insert(entity)).thenReturn(1);

        try (MockedStatic<MapstructUtils> mapstructUtils = mockStatic(MapstructUtils.class)) {
            mapstructUtils.when(() -> MapstructUtils.convert(bo, SysConfig.class)).thenReturn(entity);

            String result = service.insertConfig(bo);

            assertEquals("v1", result);
        }
    }

    @Test
    @DisplayName("insertConfig: should throw when insert affects zero rows")
    void insertConfigShouldThrowWhenInsertAffectsZeroRows() {
        SysConfigBo bo = new SysConfigBo();
        bo.setConfigKey("k0");
        bo.setConfigValue("v0");
        SysConfig entity = new SysConfig();
        entity.setConfigKey("k0");
        entity.setConfigValue("v0");
        when(sysConfigMapper.insert(entity)).thenReturn(0);

        try (MockedStatic<MapstructUtils> mapstructUtils = mockStatic(MapstructUtils.class)) {
            mapstructUtils.when(() -> MapstructUtils.convert(bo, SysConfig.class)).thenReturn(entity);

            assertThrows(ServiceException.class, () -> service.insertConfig(bo));
        }
    }

    @Test
    @DisplayName("updateConfig: should evict old key and update by id")
    void updateConfigShouldEvictOldKeyAndUpdateById() {
        SysConfigBo bo = new SysConfigBo();
        bo.setConfigId(1L);
        bo.setConfigKey("new.key");
        bo.setConfigValue("newValue");
        SysConfig entity = new SysConfig();
        entity.setConfigId(1L);
        entity.setConfigKey("new.key");
        entity.setConfigValue("newValue");
        SysConfig old = new SysConfig();
        old.setConfigId(1L);
        old.setConfigKey("old.key");
        when(sysConfigMapper.selectById(1L)).thenReturn(old);
        when(sysConfigMapper.updateById(entity)).thenReturn(1);

        try (MockedStatic<MapstructUtils> mapstructUtils = mockStatic(MapstructUtils.class);
             MockedStatic<CacheUtils> cacheUtils = mockStatic(CacheUtils.class)) {
            mapstructUtils.when(() -> MapstructUtils.convert(bo, SysConfig.class)).thenReturn(entity);

            String value = service.updateConfig(bo);

            assertEquals("newValue", value);
            cacheUtils.verify(() -> CacheUtils.evict(CacheNames.SYS_CONFIG, "old.key"));
        }
    }

    @Test
    @DisplayName("updateConfig: should reject non-superadmin when existing key is sensitive")
    void updateConfigShouldRejectNonSuperAdminWhenExistingKeyIsSensitive() {
        SysConfigBo bo = new SysConfigBo();
        bo.setConfigId(5L);
        bo.setConfigKey("sys.safe");
        bo.setConfigValue("false");
        SysConfig entity = new SysConfig();
        entity.setConfigId(5L);
        entity.setConfigKey("sys.safe");
        entity.setConfigValue("false");
        SysConfig existing = new SysConfig();
        existing.setConfigId(5L);
        existing.setConfigKey(SystemConstants.ACCOUNT_REGISTER_CONFIG_KEY);
        when(sysConfigMapper.selectById(5L)).thenReturn(existing);

        try (MockedStatic<MapstructUtils> mapstructUtils = mockStatic(MapstructUtils.class);
             MockedStatic<LoginUserContext> loginUserContext = mockStatic(LoginUserContext.class)) {
            mapstructUtils.when(() -> MapstructUtils.convert(bo, SysConfig.class)).thenReturn(entity);
            loginUserContext.when(LoginUserContext::isLogin).thenReturn(true);
            loginUserContext.when(LoginUserContext::isSuperAdmin).thenReturn(false);

            assertThrows(ServiceException.class, () -> service.updateConfig(bo));
            verify(sysConfigMapper, never()).updateById(any(SysConfig.class));
        }
    }

    @Test
    @DisplayName("updateConfig: should update by key when configId is null")
    void updateConfigShouldUpdateByKeyWhenConfigIdIsNull() {
        SysConfigBo bo = new SysConfigBo();
        bo.setConfigId(null);
        bo.setConfigKey("sys.mode");
        bo.setConfigValue("dev");
        SysConfig entity = new SysConfig();
        entity.setConfigId(null);
        entity.setConfigKey("sys.mode");
        entity.setConfigValue("dev");
        when(sysConfigMapper.update(eq(entity), any())).thenReturn(1);

        try (MockedStatic<MapstructUtils> mapstructUtils = mockStatic(MapstructUtils.class);
             MockedStatic<CacheUtils> cacheUtils = mockStatic(CacheUtils.class)) {
            mapstructUtils.when(() -> MapstructUtils.convert(bo, SysConfig.class)).thenReturn(entity);

            String value = service.updateConfig(bo);

            assertEquals("dev", value);
            cacheUtils.verify(() -> CacheUtils.evict(CacheNames.SYS_CONFIG, "sys.mode"));
        }
    }

    @Test
    @DisplayName("updateConfig: should throw when no rows updated")
    void updateConfigShouldThrowWhenNoRowsUpdated() {
        SysConfigBo bo = new SysConfigBo();
        bo.setConfigId(null);
        bo.setConfigKey("sys.mode");
        bo.setConfigValue("prod");
        SysConfig entity = new SysConfig();
        entity.setConfigId(null);
        entity.setConfigKey("sys.mode");
        entity.setConfigValue("prod");
        when(sysConfigMapper.update(eq(entity), any())).thenReturn(0);

        try (MockedStatic<MapstructUtils> mapstructUtils = mockStatic(MapstructUtils.class);
             MockedStatic<CacheUtils> cacheUtils = mockStatic(CacheUtils.class)) {
            mapstructUtils.when(() -> MapstructUtils.convert(bo, SysConfig.class)).thenReturn(entity);

            assertThrows(ServiceException.class, () -> service.updateConfig(bo));
            cacheUtils.verify(() -> CacheUtils.evict(CacheNames.SYS_CONFIG, "sys.mode"));
        }
    }

    @Test
    @DisplayName("resetConfigByKey: should restore default and sync invite register")
    void resetConfigByKeyShouldRestoreDefaultAndSyncInviteRegister() {
        SysConfig existing = new SysConfig();
        existing.setConfigId(5L);
        existing.setConfigName("注册开关");
        existing.setConfigKey(SystemConstants.ACCOUNT_REGISTER_CONFIG_KEY);
        existing.setConfigValue("true");
        existing.setValueType("switch");
        existing.setDefaultValue("false");
        existing.setGroupKey("account");
        existing.setDisplayOrder(10);
        when(sysConfigMapper.selectOne(any())).thenReturn(existing);
        when(sysConfigMapper.updateById(existing)).thenReturn(1);
        when(sysConfigMapper.update(any(SysConfig.class), any())).thenReturn(1);

        try (MockedStatic<CacheUtils> cacheUtils = mockStatic(CacheUtils.class);
             MockedStatic<LoginUserContext> loginUserContext = mockStatic(LoginUserContext.class)) {
            loginUserContext.when(LoginUserContext::isLogin).thenReturn(true);
            loginUserContext.when(LoginUserContext::isSuperAdmin).thenReturn(true);

            String value = service.resetConfigByKey(SystemConstants.ACCOUNT_REGISTER_CONFIG_KEY);

            assertEquals("false", value);
            assertEquals("false", existing.getConfigValue());
            verify(sysConfigMapper).updateById(existing);
            verify(sysConfigMapper).update(any(SysConfig.class), any());
            cacheUtils.verify(() -> CacheUtils.evict(CacheNames.SYS_CONFIG, SystemConstants.ACCOUNT_INVITE_REGISTER_CONFIG_KEY));
        }
    }

    @Test
    @DisplayName("resetConfigByKey: should reject config without default value")
    void resetConfigByKeyShouldRejectMissingDefaultValue() {
        SysConfig existing = new SysConfig();
        existing.setConfigId(9L);
        existing.setConfigKey("sys.no.default");
        existing.setConfigValue("v");
        existing.setValueType("text");
        existing.setDefaultValue(null);
        when(sysConfigMapper.selectOne(any())).thenReturn(existing);

        assertThrows(ServiceException.class, () -> service.resetConfigByKey("sys.no.default"));
    }

    @Test
    @DisplayName("reorderConfigs: should update rows for superadmin only")
    void reorderConfigsShouldUpdateRowsForSuperadminOnly() {
        cc.infoq.system.domain.bo.SysConfigReorderBo row = new cc.infoq.system.domain.bo.SysConfigReorderBo();
        row.setConfigId(5L);
        row.setGroupKey("account");
        row.setDisplayOrder(30);
        SysConfig existing = new SysConfig();
        existing.setConfigId(5L);

        when(sysConfigMapper.selectByIds(any())).thenReturn(List.of(existing));
        when(sysConfigMapper.updateById(any(SysConfig.class))).thenReturn(1);

        try (MockedStatic<LoginUserContext> loginUserContext = mockStatic(LoginUserContext.class)) {
            loginUserContext.when(LoginUserContext::isSuperAdmin).thenReturn(true);

            service.reorderConfigs(List.of(row));

            verify(sysConfigMapper).updateById(any(SysConfig.class));
        }
    }

    @Test
    @DisplayName("reorderConfigs: should reject non-superadmin")
    void reorderConfigsShouldRejectNonSuperadmin() {
        cc.infoq.system.domain.bo.SysConfigReorderBo row = new cc.infoq.system.domain.bo.SysConfigReorderBo();
        row.setConfigId(5L);
        row.setGroupKey("account");
        row.setDisplayOrder(30);

        try (MockedStatic<LoginUserContext> loginUserContext = mockStatic(LoginUserContext.class)) {
            loginUserContext.when(LoginUserContext::isSuperAdmin).thenReturn(false);

            assertThrows(ServiceException.class, () -> service.reorderConfigs(List.of(row)));
            verify(sysConfigMapper, never()).selectByIds(any());
        }
    }

    @Test
    @DisplayName("deleteConfigByIds: should reject built-in config")
    void deleteConfigByIdsShouldRejectBuiltInConfig() {
        SysConfig builtIn = new SysConfig();
        builtIn.setConfigId(1L);
        builtIn.setConfigType(SystemConstants.YES);
        builtIn.setConfigKey("sys.builtin");
        when(sysConfigMapper.selectByIds(List.of(1L))).thenReturn(List.of(builtIn));

        assertThrows(ServiceException.class, () -> service.deleteConfigByIds(List.of(1L)));
    }

    @Test
    @DisplayName("deleteConfigByIds: should evict cache and delete rows")
    void deleteConfigByIdsShouldEvictCacheAndDeleteRows() {
        SysConfig normal = new SysConfig();
        normal.setConfigId(2L);
        normal.setConfigType("N");
        normal.setConfigKey("sys.normal");
        when(sysConfigMapper.selectByIds(List.of(2L))).thenReturn(List.of(normal));

        try (MockedStatic<CacheUtils> cacheUtils = mockStatic(CacheUtils.class)) {
            service.deleteConfigByIds(List.of(2L));

            verify(sysConfigMapper).deleteByIds(List.of(2L));
            cacheUtils.verify(() -> CacheUtils.evict(CacheNames.SYS_CONFIG, "sys.normal"));
        }
    }

    @Test
    @DisplayName("checkConfigKeyUnique: should return false when key exists")
    void checkConfigKeyUniqueShouldReturnFalseWhenKeyExists() {
        SysConfigBo bo = new SysConfigBo();
        bo.setConfigKey("dup");
        bo.setConfigId(1L);
        when(sysConfigMapper.exists(any())).thenReturn(true);

        assertFalse(service.checkConfigKeyUnique(bo));
    }

    @Test
    @DisplayName("resetConfigCache: should clear cache namespace")
    void resetConfigCacheShouldClearNamespace() {
        try (MockedStatic<CacheUtils> cacheUtils = mockStatic(CacheUtils.class)) {
            service.resetConfigCache();
            cacheUtils.verify(() -> CacheUtils.clear(CacheNames.SYS_CONFIG));
        }
    }

    @Test
    @DisplayName("getConfigValue: should call selectConfigByKey through AOP proxy")
    void getConfigValueShouldCallSelectConfigByKeyThroughAopProxy() {
        SysConfigServiceImpl spyService = spy(service);
        doReturn("v").when(spyService).selectConfigByKey("k");

        try (MockedStatic<SpringUtils> springUtils = mockStatic(SpringUtils.class)) {
            springUtils.when(() -> SpringUtils.getAopProxy(spyService)).thenReturn(spyService);

            String value = spyService.getConfigValue("k");

            assertEquals("v", value);
        }
    }

    @Test
    @DisplayName("getConfigArray: should parse list json through config value")
    void getConfigArrayShouldParseListJsonThroughConfigValue() {
        SysConfigServiceImpl spyService = spy(service);
        doReturn("[\"a\",\"b\"]").when(spyService).getConfigValue("arr");

        List<String> list = spyService.getConfigArray("arr", String.class);

        assertEquals(List.of("a", "b"), list);
    }

    @Test
    @DisplayName("getConfigMap/getConfigArrayMap: should parse map and map-list json")
    void getConfigMapAndArrayMapShouldParseJson() {
        SysConfigServiceImpl spyService = spy(service);
        doReturn("{\"k\":\"v\"}").when(spyService).getConfigValue("map");
        doReturn("[{\"k\":\"v1\"},{\"k\":\"v2\"}]").when(spyService).getConfigValue("map-list");

        Dict map = spyService.getConfigMap("map");
        List<Dict> mapList = spyService.getConfigArrayMap("map-list");

        assertEquals("v", map.getStr("k"));
        assertEquals(2, mapList.size());
        assertEquals("v2", mapList.get(1).getStr("k"));
    }

    @Test
    @DisplayName("getConfigObject: should parse json into target object")
    void getConfigObjectShouldParseJsonIntoTargetObject() {
        SysConfigServiceImpl spyService = spy(service);
        doReturn("{\"configKey\":\"sys.mode\",\"configValue\":\"dev\"}")
            .when(spyService).getConfigValue("obj");

        SysConfig object = spyService.getConfigObject("obj", SysConfig.class);

        assertEquals("sys.mode", object.getConfigKey());
        assertEquals("dev", object.getConfigValue());
    }
}
