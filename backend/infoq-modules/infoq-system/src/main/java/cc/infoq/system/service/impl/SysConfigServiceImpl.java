package cc.infoq.system.service.impl;

import cc.infoq.common.constant.CacheNames;
import cc.infoq.common.constant.SystemConstants;
import cc.infoq.common.exception.ServiceException;
import cc.infoq.common.json.utils.JsonUtils;
import cc.infoq.common.mybatis.core.page.PageQuery;
import cc.infoq.common.mybatis.core.page.TableDataInfo;
import cc.infoq.common.redis.utils.CacheUtils;
import cc.infoq.common.security.auth.LoginUserContext;
import cc.infoq.common.security.auth.SecurityAuthorizationService;
import cc.infoq.common.service.ConfigService;
import cc.infoq.common.utils.MapstructUtils;
import cc.infoq.common.utils.ObjectUtils;
import cc.infoq.common.utils.SpringUtils;
import cc.infoq.common.utils.StringUtils;
import cc.infoq.system.domain.bo.SysConfigBo;
import cc.infoq.system.domain.bo.SysConfigReorderBo;
import cc.infoq.system.domain.entity.SysConfig;
import cc.infoq.system.domain.vo.*;
import cc.infoq.system.enums.ConfigGroupEnum;
import cc.infoq.system.mapper.SysConfigMapper;
import cc.infoq.system.service.SysConfigService;
import cn.hutool.core.convert.Convert;
import cn.hutool.core.lang.Dict;
import cn.hutool.core.util.ObjectUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.core.type.TypeReference;
import lombok.AllArgsConstructor;
import org.springframework.cache.annotation.CachePut;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

/**
 * 参数配置 服务层实现
 *
 * @author Pontus
 */
@AllArgsConstructor
@Service
public class SysConfigServiceImpl implements SysConfigService, ConfigService {

    private static final String VALUE_TYPE_TEXT = "text";
    private static final String VALUE_TYPE_PASSWORD = "password";
    private static final String VALUE_TYPE_SWITCH = "switch";
    private static final String VALUE_TYPE_SELECT = "select";
    private static final Set<String> PANEL_EDITABLE_VALUE_TYPES = Set.of(
        VALUE_TYPE_TEXT,
        VALUE_TYPE_PASSWORD,
        VALUE_TYPE_SWITCH,
        VALUE_TYPE_SELECT
    );
    private static final TypeReference<Map<String, Object>> UI_PROPS_TYPE = new TypeReference<>() {
    };

    private final SysConfigMapper sysConfigMapper;

    private final SecurityAuthorizationService securityAuthorizationService;

    /**
     * 分页查询参数配置列表
     *
     * @param config    查询条件
     * @param pageQuery 分页参数
     * @return 参数配置分页列表
     */
    @Override
    public TableDataInfo<SysConfigVo> selectPageConfigList(SysConfigBo config, PageQuery pageQuery) {
        LambdaQueryWrapper<SysConfig> lqw = buildQueryWrapper(config);
        Page<SysConfigVo> page = sysConfigMapper.selectVoPage(pageQuery.build(), lqw);
        return TableDataInfo.build(page);
    }

    /**
     * 查询参数配置信息
     *
     * @param configId 参数配置ID
     * @return 参数配置信息
     */
    @Override
    public SysConfigVo selectConfigById(Long configId) {
        return sysConfigMapper.selectVoById(configId);
    }

    /**
     * 根据键名查询参数配置信息
     *
     * @param configKey 参数key
     * @return 参数键值
     */
    @Cacheable(cacheNames = CacheNames.SYS_CONFIG, key = "#configKey")
    @Override
    public String selectConfigByKey(String configKey) {
        SysConfig retConfig = sysConfigMapper.selectOne(new LambdaQueryWrapper<SysConfig>()
            .eq(SysConfig::getConfigKey, configKey));
        return ObjectUtils.notNullGetter(retConfig, SysConfig::getConfigValue, StringUtils.EMPTY);
    }

    /**
     * 获取注册开关
     * @return true开启，false关闭
     */
    @Override
    public boolean selectRegisterEnabled() {
        String configValue = this.selectConfigByKey(SystemConstants.ACCOUNT_REGISTER_CONFIG_KEY);
        return Convert.toBool(configValue);
    }

    /**
     * 获取邀请码注册开关
     *
     * @return true开启，false关闭
     */
    @Override
    public boolean selectInviteRegisterEnabled() {
        String configValue = this.selectConfigByKey(SystemConstants.ACCOUNT_INVITE_REGISTER_CONFIG_KEY);
        return Convert.toBool(configValue);
    }

    /**
     * 获取忘记密码开关
     *
     * @return true 开启，false 关闭
     */
    @Override
    public boolean selectForgotPasswordEnabled() {
        String configValue = this.selectConfigByKey(SystemConstants.ACCOUNT_FORGOT_PASSWORD_CONFIG_KEY);
        return Convert.toBool(configValue);
    }

    /**
     * 查询参数配置列表
     *
     * @param config 参数配置信息
     * @return 参数配置集合
     */
    @Override
    public List<SysConfigVo> selectConfigList(SysConfigBo config) {
        LambdaQueryWrapper<SysConfig> lqw = buildQueryWrapper(config);
        return sysConfigMapper.selectVoList(lqw);
    }

    /**
     * 查询参数配置面板
     *
     * @return 分组后的配置面板
     */
    @Override
    public SysConfigPanelVo selectConfigPanel() {
        List<SysConfig> configs = sysConfigMapper.selectList(new LambdaQueryWrapper<SysConfig>()
            .orderByAsc(SysConfig::getGroupKey)
            .orderByAsc(SysConfig::getDisplayOrder)
            .orderByAsc(SysConfig::getConfigId));
        Map<String, SysConfigPanelGroupVo> groups = ConfigGroupEnum.orderedValues().stream()
            .collect(Collectors.toMap(
                ConfigGroupEnum::getKey,
                this::toPanelGroup,
                (left, right) -> left,
                LinkedHashMap::new
            ));
        configs.stream()
            .map(this::toPanelItem)
            .sorted(Comparator
                .comparing(SysConfigPanelItemVo::getDisplayOrder, Comparator.nullsLast(Integer::compareTo))
                .thenComparing(SysConfigPanelItemVo::getConfigId, Comparator.nullsLast(Long::compareTo)))
            .forEach(item -> groups.get(item.getGroupKey()).getItems().add(item));
        SysConfigPanelVo panel = new SysConfigPanelVo();
        panel.setGroups(new ArrayList<>(groups.values()));
        return panel;
    }

    private LambdaQueryWrapper<SysConfig> buildQueryWrapper(SysConfigBo bo) {
        Map<String, Object> params = bo.getParams();
        LambdaQueryWrapper<SysConfig> lqw = Wrappers.lambdaQuery();
        lqw.like(StringUtils.isNotBlank(bo.getConfigName()), SysConfig::getConfigName, bo.getConfigName());
        lqw.eq(StringUtils.isNotBlank(bo.getConfigType()), SysConfig::getConfigType, bo.getConfigType());
        lqw.like(StringUtils.isNotBlank(bo.getConfigKey()), SysConfig::getConfigKey, bo.getConfigKey());
        lqw.between(params.get("beginTime") != null && params.get("endTime") != null,
            SysConfig::getCreateTime, params.get("beginTime"), params.get("endTime"));
        lqw.orderByAsc(SysConfig::getGroupKey);
        lqw.orderByAsc(SysConfig::getDisplayOrder);
        lqw.orderByAsc(SysConfig::getConfigId);
        return lqw;
    }

    /**
     * 新增参数配置
     *
     * @param bo 参数配置信息
     * @return 结果
     */
    @CachePut(cacheNames = CacheNames.SYS_CONFIG, key = "#bo.configKey")
    @Transactional(rollbackFor = Exception.class)
    @Override
    public String insertConfig(SysConfigBo bo) {
        SysConfig config = MapstructUtils.convert(bo, SysConfig.class);
        validateSensitiveConfigAccess(config);
        normalizeConfigMetadata(config);
        validateConfigMetadata(config);
        normalizeSensitiveConfigValue(config);
        int row = sysConfigMapper.insert(config);
        if (row > 0) {
            syncInviteRegisterConfigIfNeeded(config);
            return config.getConfigValue();
        }
        throw new ServiceException("操作失败");
    }

    /**
     * 修改参数配置
     *
     * @param bo 参数配置信息
     * @return 结果
     */
    @CachePut(cacheNames = CacheNames.SYS_CONFIG, key = "#bo.configKey")
    @Transactional(rollbackFor = Exception.class)
    @Override
    public String updateConfig(SysConfigBo bo) {
        int row = 0;
        SysConfig config = MapstructUtils.convert(bo, SysConfig.class);
        validateSensitiveConfigAccess(config);
        SysConfig existing = null;
        if (config.getConfigId() != null) {
            existing = sysConfigMapper.selectById(config.getConfigId());
            if (existing == null) {
                throw new ServiceException("参数配置不存在");
            }
            validateSensitiveConfigAccess(existing);
        }
        SysConfig validationConfig = mergeExistingConfig(config, existing);
        normalizeConfigMetadata(validationConfig);
        validateConfigMetadata(validationConfig);
        normalizeSensitiveConfigValue(validationConfig);
        config.setConfigValue(validationConfig.getConfigValue());
        if (config.getConfigId() != null) {
            if (!StringUtils.equals(existing.getConfigKey(), config.getConfigKey())) {
                CacheUtils.evict(CacheNames.SYS_CONFIG, existing.getConfigKey());
            }
            row = sysConfigMapper.updateById(config);
        } else {
            CacheUtils.evict(CacheNames.SYS_CONFIG, config.getConfigKey());
            row = sysConfigMapper.update(config, new LambdaQueryWrapper<SysConfig>()
                .eq(SysConfig::getConfigKey, config.getConfigKey()));
        }
        if (row > 0) {
            syncInviteRegisterConfigIfNeeded(config);
            return config.getConfigValue();
        }
        throw new ServiceException("操作失败");
    }

    /**
     * 根据参数 key 恢复默认值
     *
     * @param configKey 参数 key
     * @return 恢复后的参数值
     */
    @CachePut(cacheNames = CacheNames.SYS_CONFIG, key = "#configKey")
    @Transactional(rollbackFor = Exception.class)
    @Override
    public String resetConfigByKey(String configKey) {
        SysConfig existing = selectEntityByKey(configKey);
        if (existing == null) {
            throw new ServiceException("参数配置不存在");
        }
        if (existing.getDefaultValue() == null) {
            throw new ServiceException("该参数没有默认值，无法恢复默认");
        }
        validateSensitiveConfigAccess(existing);
        existing.setConfigValue(existing.getDefaultValue());
        normalizeConfigMetadata(existing);
        validateConfigMetadata(existing);
        normalizeSensitiveConfigValue(existing);
        int row = sysConfigMapper.updateById(existing);
        if (row > 0) {
            syncInviteRegisterConfigIfNeeded(existing);
            return existing.getConfigValue();
        }
        throw new ServiceException("操作失败");
    }

    /**
     * 批量调整配置分组与顺序
     *
     * @param rows 排序请求
     */
    @Transactional(rollbackFor = Exception.class)
    @Override
    public void reorderConfigs(List<SysConfigReorderBo> rows) {
        if (!LoginUserContext.isSuperAdmin()) {
            throw new ServiceException("仅超级管理员可调整配置顺序");
        }
        if (ObjectUtils.isEmpty(rows)) {
            throw new ServiceException("排序参数不能为空");
        }
        rows.forEach(row -> {
            if (!ConfigGroupEnum.isKnown(row.getGroupKey())) {
                throw new ServiceException("配置分组不存在: {}", row.getGroupKey());
            }
        });
        Set<Long> configIds = rows.stream().map(SysConfigReorderBo::getConfigId).collect(Collectors.toSet());
        List<SysConfig> existing = sysConfigMapper.selectByIds(configIds);
        if (existing.size() != configIds.size()) {
            throw new ServiceException("排序参数包含不存在的配置项");
        }
        for (SysConfigReorderBo row : rows) {
            SysConfig update = new SysConfig();
            update.setConfigId(row.getConfigId());
            update.setGroupKey(row.getGroupKey());
            update.setDisplayOrder(row.getDisplayOrder());
            if (sysConfigMapper.updateById(update) <= 0) {
                throw new ServiceException("配置排序更新失败");
            }
        }
    }

    /**
     * 批量删除参数信息
     *
     * @param configIds 需要删除的参数ID
     */
    @Override
    public void deleteConfigByIds(List<Long> configIds) {
        List<SysConfig> list = sysConfigMapper.selectByIds(configIds);
        list.forEach(config -> {
            if (StringUtils.equals(SystemConstants.YES, config.getConfigType())) {
                throw new ServiceException("内置参数【{}】不能删除", config.getConfigKey());
            }
            CacheUtils.evict(CacheNames.SYS_CONFIG, config.getConfigKey());
        });
        sysConfigMapper.deleteByIds(configIds);
    }

    /**
     * 重置参数缓存数据
     */
    @Override
    public void resetConfigCache() {
        CacheUtils.clear(CacheNames.SYS_CONFIG);
    }

    /**
     * 校验参数键名是否唯一
     *
     * @param config 参数配置信息
     * @return 结果
     */
    @Override
    public boolean checkConfigKeyUnique(SysConfigBo config) {
        boolean exist = sysConfigMapper.exists(new LambdaQueryWrapper<SysConfig>()
            .eq(SysConfig::getConfigKey, config.getConfigKey())
            .ne(ObjectUtil.isNotNull(config.getConfigId()), SysConfig::getConfigId, config.getConfigId()));
        return !exist;
    }

    /**
     * 根据参数 key 获取参数值
     *
     * @param configKey 参数 key
     * @return 参数值
     */
    @Override
    public String getConfigValue(String configKey) {
        return SpringUtils.getAopProxy(this).selectConfigByKey(configKey);
    }

    /**
     * 根据参数 key 获取 Map 类型的配置
     *
     * @param configKey 参数 key
     * @return Dict 对象，如果配置为空或无法解析，返回空 Dict
     */
    @Override
    public Dict getConfigMap(String configKey) {
        String configValue = getConfigValue(configKey);
        return JsonUtils.parseMap(configValue);
    }

    /**
     * 根据参数 key 获取 Map 类型的配置列表
     *
     * @param configKey 参数 key
     * @return Dict 列表，如果配置为空或无法解析，返回空列表
     */
    @Override
    public List<Dict> getConfigArrayMap(String configKey) {
        String configValue = getConfigValue(configKey);
        return JsonUtils.parseArrayMap(configValue);
    }

    /**
     * 根据参数 key 获取指定类型的配置对象
     *
     * @param configKey 参数 key
     * @param clazz     目标对象类型
     * @return 对象实例，如果配置为空或无法解析，返回 null
     */
    @Override
    public <T> T getConfigObject(String configKey, Class<T> clazz) {
        String configValue = getConfigValue(configKey);
        return JsonUtils.parseObject(configValue, clazz);
    }

    /**
     * 根据参数 key 获取指定类型的配置列表=
     *
     * @param configKey 参数 key
     * @param clazz     目标元素类型
     * @return 指定类型列表，如果配置为空或无法解析，返回空列表
     */
    @Override
    public <T> List<T> getConfigArray(String configKey, Class<T> clazz) {
        String configValue = getConfigValue(configKey);
        return JsonUtils.parseArray(configValue, clazz);
    }

    private SysConfigPanelGroupVo toPanelGroup(ConfigGroupEnum group) {
        SysConfigPanelGroupVo vo = new SysConfigPanelGroupVo();
        vo.setGroupKey(group.getKey());
        vo.setGroupName(group.getName());
        vo.setDisplayOrder(group.getDisplayOrder());
        return vo;
    }

    private SysConfigPanelItemVo toPanelItem(SysConfig config) {
        String valueType = normalizeValueType(config.getValueType());
        ConfigGroupEnum group = ConfigGroupEnum.resolve(config.getGroupKey());
        Map<String, Object> uiProps = parseUiProps(config.getUiPropsJson());
        SysConfigPanelItemVo item = new SysConfigPanelItemVo();
        item.setConfigId(config.getConfigId());
        item.setConfigName(config.getConfigName());
        item.setConfigKey(config.getConfigKey());
        item.setConfigValue(config.getConfigValue());
        item.setConfigType(config.getConfigType());
        item.setValueType(valueType);
        item.setDefaultValue(config.getDefaultValue());
        item.setGroupKey(group.getKey());
        item.setDisplayOrder(ObjectUtil.defaultIfNull(config.getDisplayOrder(), 0));
        item.setOptions(parseOptions(config.getOptionsJson()));
        item.setUiProps(uiProps);
        item.setEditable(isEditable(config, valueType, uiProps));
        item.setEditableReason(item.getEditable() ? null : getEditableReason(config, valueType, uiProps));
        item.setRemark(config.getRemark());
        item.setCreateTime(config.getCreateTime());
        item.setUpdateTime(config.getUpdateTime());
        return item;
    }

    private boolean isEditable(SysConfig config, String valueType, Map<String, Object> uiProps) {
        return getEditableReason(config, valueType, uiProps) == null;
    }

    private String getEditableReason(SysConfig config, String valueType, Map<String, Object> uiProps) {
        if (!hasEditPermission()) {
            return "缺少 system:config:edit 权限";
        }
        if (isReadonly(uiProps)) {
            return "该配置已标记为只读";
        }
        if (isSensitiveConfig(config.getConfigKey()) && !LoginUserContext.isSuperAdmin()) {
            return "账号敏感配置仅超级管理员可编辑";
        }
        if (!PANEL_EDITABLE_VALUE_TYPES.contains(valueType)) {
            return "该类型暂不支持在配置中心直接编辑";
        }
        return null;
    }

    private boolean hasEditPermission() {
        try {
            return securityAuthorizationService.hasPermission("system:config:edit");
        } catch (Exception e) {
            return false;
        }
    }

    private boolean isReadonly(Map<String, Object> uiProps) {
        if (uiProps == null) {
            return false;
        }
        return Convert.toBool(uiProps.get("readonly"), false);
    }

    private List<SysConfigOptionVo> parseOptions(String optionsJson) {
        if (StringUtils.isBlank(optionsJson)) {
            return null;
        }
        try {
            return JsonUtils.parseArray(optionsJson, SysConfigOptionVo.class);
        } catch (RuntimeException e) {
            throw new ServiceException("配置选项 JSON 格式错误");
        }
    }

    private Map<String, Object> parseUiProps(String uiPropsJson) {
        if (StringUtils.isBlank(uiPropsJson)) {
            return Map.of();
        }
        try {
            Map<String, Object> parsed = JsonUtils.parseObject(uiPropsJson, UI_PROPS_TYPE);
            return ObjectUtil.defaultIfNull(parsed, Map.of());
        } catch (RuntimeException e) {
            throw new ServiceException("UI 属性 JSON 格式错误");
        }
    }

    private void normalizeConfigMetadata(SysConfig config) {
        config.setValueType(normalizeValueType(config.getValueType()));
        if (StringUtils.isBlank(config.getGroupKey())) {
            config.setGroupKey(null);
        }
        if (config.getDisplayOrder() == null) {
            config.setDisplayOrder(0);
        }
    }

    private String normalizeValueType(String valueType) {
        return StringUtils.blankToDefault(valueType, VALUE_TYPE_TEXT);
    }

    private void validateConfigMetadata(SysConfig config) {
        if (!PANEL_EDITABLE_VALUE_TYPES.contains(config.getValueType())) {
            throw new ServiceException("暂不支持的参数值类型: {}", config.getValueType());
        }
        if (StringUtils.isNotBlank(config.getGroupKey()) && !ConfigGroupEnum.isKnown(config.getGroupKey())) {
            throw new ServiceException("配置分组不存在: {}", config.getGroupKey());
        }
        if (VALUE_TYPE_SWITCH.equals(config.getValueType())) {
            validateBooleanValue(config.getConfigValue(), "参数键值");
            validateBooleanValue(config.getDefaultValue(), "默认值");
            return;
        }
        if (VALUE_TYPE_SELECT.equals(config.getValueType())) {
            validateSelectValue(config);
        }
    }

    private void validateBooleanValue(String value, String fieldName) {
        if (value == null) {
            return;
        }
        if (!StringUtils.equalsAny(value, Boolean.TRUE.toString(), Boolean.FALSE.toString())) {
            throw new ServiceException("{}只允许 true 或 false", fieldName);
        }
    }

    private void validateSelectValue(SysConfig config) {
        List<SysConfigOptionVo> options = parseOptions(config.getOptionsJson());
        if (ObjectUtils.isEmpty(options)) {
            throw new ServiceException("下拉类型必须配置选项");
        }
        Set<String> values = options.stream()
            .map(SysConfigOptionVo::getValue)
            .collect(Collectors.toSet());
        if (!values.contains(config.getConfigValue())) {
            throw new ServiceException("参数键值不在下拉选项范围内");
        }
        if (config.getDefaultValue() != null && !values.contains(config.getDefaultValue())) {
            throw new ServiceException("默认值不在下拉选项范围内");
        }
    }

    private SysConfig mergeExistingConfig(SysConfig config) {
        return mergeExistingConfig(config, null);
    }

    private SysConfig mergeExistingConfig(SysConfig config, SysConfig existing) {
        if (existing == null) {
            existing = config.getConfigId() != null ? sysConfigMapper.selectById(config.getConfigId()) : selectEntityByKey(config.getConfigKey());
        }
        if (existing == null) {
            return config;
        }
        SysConfig merged = new SysConfig();
        merged.setConfigId(ObjectUtil.defaultIfNull(config.getConfigId(), existing.getConfigId()));
        merged.setConfigName(ObjectUtil.defaultIfNull(config.getConfigName(), existing.getConfigName()));
        merged.setConfigKey(ObjectUtil.defaultIfNull(config.getConfigKey(), existing.getConfigKey()));
        merged.setConfigValue(ObjectUtil.defaultIfNull(config.getConfigValue(), existing.getConfigValue()));
        merged.setValueType(ObjectUtil.defaultIfNull(config.getValueType(), existing.getValueType()));
        merged.setDefaultValue(ObjectUtil.defaultIfNull(config.getDefaultValue(), existing.getDefaultValue()));
        merged.setGroupKey(ObjectUtil.defaultIfNull(config.getGroupKey(), existing.getGroupKey()));
        merged.setDisplayOrder(ObjectUtil.defaultIfNull(config.getDisplayOrder(), existing.getDisplayOrder()));
        merged.setOptionsJson(ObjectUtil.defaultIfNull(config.getOptionsJson(), existing.getOptionsJson()));
        merged.setUiPropsJson(ObjectUtil.defaultIfNull(config.getUiPropsJson(), existing.getUiPropsJson()));
        merged.setConfigType(ObjectUtil.defaultIfNull(config.getConfigType(), existing.getConfigType()));
        merged.setRemark(ObjectUtil.defaultIfNull(config.getRemark(), existing.getRemark()));
        return merged;
    }

    private SysConfig selectEntityByKey(String configKey) {
        return sysConfigMapper.selectOne(new LambdaQueryWrapper<SysConfig>()
            .eq(SysConfig::getConfigKey, configKey));
    }

    private void validateSensitiveConfigAccess(SysConfig config) {
        if (!isSensitiveConfig(config.getConfigKey())) {
            return;
        }
        if (LoginUserContext.isLogin() && !LoginUserContext.isSuperAdmin()) {
            throw new ServiceException("仅超级管理员可修改该参数");
        }
    }

    private void normalizeSensitiveConfigValue(SysConfig config) {
        if (StringUtils.equals(config.getConfigKey(), SystemConstants.ACCOUNT_INVITE_REGISTER_CONFIG_KEY)
            && !this.selectRegisterEnabled()) {
            config.setConfigValue(Boolean.FALSE.toString());
        }
    }

    private void syncInviteRegisterConfigIfNeeded(SysConfig config) {
        if (!StringUtils.equals(config.getConfigKey(), SystemConstants.ACCOUNT_REGISTER_CONFIG_KEY)) {
            return;
        }
        if (Convert.toBool(config.getConfigValue())) {
            return;
        }
        CacheUtils.evict(CacheNames.SYS_CONFIG, SystemConstants.ACCOUNT_INVITE_REGISTER_CONFIG_KEY);
        SysConfig inviteConfig = new SysConfig();
        inviteConfig.setConfigValue(Boolean.FALSE.toString());
        sysConfigMapper.update(inviteConfig, new LambdaQueryWrapper<SysConfig>()
            .eq(SysConfig::getConfigKey, SystemConstants.ACCOUNT_INVITE_REGISTER_CONFIG_KEY));
    }

    private boolean isSensitiveConfig(String configKey) {
        return StringUtils.equalsAny(configKey,
            SystemConstants.ACCOUNT_REGISTER_CONFIG_KEY,
            SystemConstants.ACCOUNT_INVITE_REGISTER_CONFIG_KEY,
            SystemConstants.ACCOUNT_FORGOT_PASSWORD_CONFIG_KEY);
    }
}
