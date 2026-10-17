package cc.infoq.system.controller.monitor;

import cc.infoq.common.domain.ApiResult;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.redisson.spring.data.connection.RedissonConnectionFactory;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.connection.RedisCommands;

import java.util.Properties;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@Tag("dev")
class CacheControllerTest {

    @Mock
    private RedissonConnectionFactory connectionFactory;
    @Mock
    private RedisConnection redisConnection;
    @Mock
    private RedisCommands commands;

    @Test
    @DisplayName("getInfo: should parse redis commandstats and return success")
    void getInfoShouldParseCommandStats() throws Exception {
        when(connectionFactory.getConnection()).thenReturn(redisConnection);
        when(redisConnection.commands()).thenReturn(commands);

        Properties commandStats = new Properties();
        commandStats.setProperty("cmdstat_get", "calls=2,usec=10,usec_per_call=5");
        Properties info = new Properties();
        info.setProperty("redis_version", "7");

        when(commands.info("commandstats")).thenReturn(commandStats);
        when(commands.info()).thenReturn(info);
        when(commands.dbSize()).thenReturn(5L);

        CacheController controller = new CacheController(connectionFactory);
        ApiResult<CacheController.CacheListInfoVo> result = controller.getInfo();

        assertEquals(ApiResult.SUCCESS, result.getCode());
        assertEquals(1, result.getData().commandStats().size());
        assertEquals("get", result.getData().commandStats().get(0).get("name"));
        assertEquals("2", result.getData().commandStats().get(0).get("value"));
    }
}
