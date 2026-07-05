package cc.infoq.common.oss.factory;

import cc.infoq.common.constant.CacheNames;
import cc.infoq.common.json.utils.JsonUtils;
import cc.infoq.common.oss.constant.OssConstant;
import cc.infoq.common.oss.core.OssClient;
import cc.infoq.common.oss.exception.OssException;
import cc.infoq.common.oss.properties.OssProperties;
import cc.infoq.common.redis.utils.CacheUtils;
import cc.infoq.common.redis.utils.RedisUtils;
import cc.infoq.common.utils.StringUtils;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.slf4j.Slf4j;

import java.io.IOException;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;

/**
 * 文件上传Factory
 *
 * @author Pontus
 */
@Slf4j
public class OssFactory {

    private static final Map<String, OssClient> CLIENT_CACHE = new ConcurrentHashMap<>();
    private static final ReentrantLock LOCK = new ReentrantLock();
    private static final Set<String> LEGACY_CONFIG_FIELDS = Set.of(
        "ossConfigId", "configKey", "status", "ext1", "remark",
        "searchValue", "createDept", "createBy", "createTime", "updateBy", "updateTime", "params"
    );

    /**
     * 获取默认实例
     */
    public static OssClient instance() {
        // 获取redis 默认类型
        String configKey = RedisUtils.getCacheObject(OssConstant.DEFAULT_CONFIG_KEY);
        if (StringUtils.isEmpty(configKey)) {
            throw new OssException("文件存储服务类型无法找到!");
        }
        return instance(configKey);
    }

    /**
     * 根据类型获取实例
     */
    public static OssClient instance(String configKey) {
        String json = CacheUtils.get(CacheNames.SYS_OSS_CONFIG, configKey, String.class);
        if (json == null) {
            throw new OssException("系统异常, '" + configKey + "'配置信息不存在!");
        }
        OssProperties properties = parseProperties(json);
        String key = configKey;
        OssClient client = CLIENT_CACHE.get(key);
        // 客户端不存在或配置不相同则重新构建
        if (client == null || !client.checkPropertiesSame(properties)) {
            LOCK.lock();
            try {
                client = CLIENT_CACHE.get(key);
                if (client == null || !client.checkPropertiesSame(properties)) {
                    CLIENT_CACHE.put(key, new OssClient(configKey, properties));
                    log.info("创建OSS实例 key => {}", configKey);
                    return CLIENT_CACHE.get(key);
                }
            } finally {
                LOCK.unlock();
            }
        }
        return client;
    }

    private static OssProperties parseProperties(String json) {
        return JsonUtils.parseObjectStrict(removeLegacyConfigFields(json), OssProperties.class);
    }

    private static String removeLegacyConfigFields(String json) {
        try {
            JsonNode rootNode = JsonUtils.getObjectMapper().readTree(json);
            if (!rootNode.isObject()) {
                return json;
            }
            ObjectNode objectNode = (ObjectNode) rootNode;
            objectNode.remove(LEGACY_CONFIG_FIELDS);
            return objectNode.toString();
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }

}
