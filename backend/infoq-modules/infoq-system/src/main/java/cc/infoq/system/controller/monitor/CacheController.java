package cc.infoq.system.controller.monitor;

import cc.infoq.common.domain.ApiResult;
import cc.infoq.common.utils.StringUtils;
import lombok.AllArgsConstructor;
import org.redisson.spring.data.connection.RedissonConnectionFactory;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.core.RedisConnectionUtils;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.*;

/**
 * 缓存监控
 *
 * @author Pontus
 */
@AllArgsConstructor
@RestController
@RequestMapping("/monitor/cache")
public class CacheController {

    private final RedissonConnectionFactory connectionFactory;

    /**
     * 获取缓存监控列表
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('monitor:cache:list')")
    @GetMapping()
    public ApiResult<CacheListInfoVo> getInfo() throws Exception {
        RedisConnection connection = connectionFactory.getConnection();
        try {
            Properties commandStats = connection.commands().info("commandstats");
            List<Map<String, String>> pieList = new ArrayList<>();
        if (commandStats != null) {
            commandStats.stringPropertyNames().forEach(key -> {
                Map<String, String> data = new HashMap<>(2);
                String property = commandStats.getProperty(key);
                data.put("name", StringUtils.removeStart(key, "cmdstat_"));
                data.put("value", StringUtils.substringBetween(property, "calls=", ",usec"));
                pieList.add(data);
            });
        }
        return ApiResult.ok(new CacheListInfoVo(
            connection.commands().info(),
            connection.commands().dbSize(), pieList));
        } finally {
            // 归还连接给连接池
            RedisConnectionUtils.releaseConnection(connection, connectionFactory);
        }
    }

    /**
     * 缓存监控列表信息
     *
     * @param info         信息
     * @param dbSize       数据库
     * @param commandStats 命令统计
     */
    public record CacheListInfoVo(Properties info, Long dbSize, List<Map<String, String>> commandStats) {}

}
