package cc.infoq.common.redis.config;

import cc.infoq.common.redis.config.properties.RedissonProperties;
import cc.infoq.common.redis.handler.KeyPrefixHandler;
import cc.infoq.common.redis.handler.RedisExceptionHandler;
import cc.infoq.common.utils.SpringUtils;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import io.netty.buffer.ByteBuf;
import org.redisson.client.codec.Codec;
import org.redisson.config.ClusterServersConfig;
import org.redisson.config.Config;
import org.redisson.config.ReadMode;
import org.redisson.config.SingleServerConfig;
import org.redisson.config.SubscriptionMode;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mockStatic;

@Tag("dev")
class RedisConfigTest {

    @Test
    @DisplayName("redissonCustomizer: should apply single-server settings and base options")
    void redissonCustomizerShouldApplySingleServerSettings() {
        RedisConfig redisConfig = new RedisConfig();
        ReflectionTestUtils.setField(redisConfig, "redissonProperties", buildSingleServerProperties());

        Config config = new Config();
        try (MockedStatic<SpringUtils> springUtils = mockStatic(SpringUtils.class)) {
            springUtils.when(SpringUtils::isVirtual).thenReturn(false);
            redisConfig.redissonCustomizer().customize(config);
        }

        assertEquals(4, config.getThreads());
        assertEquals(8, config.getNettyThreads());
        assertNotNull(config.getCodec());
        assertEquals(true, config.isUseScriptCache());

        SingleServerConfig single = (SingleServerConfig) ReflectionTestUtils.getField(config, "singleServerConfig");
        assertNotNull(single);
        assertEquals("single-client", single.getClientName());
        assertEquals(3000, single.getTimeout());
        assertEquals(10000, single.getConnectTimeout());
        assertEquals(30000, single.getPingConnectionInterval());
        assertInstanceOf(KeyPrefixHandler.class, config.getNameMapper());
        assertEquals(true, config.isTcpKeepAlive());
        assertEquals(true, config.isTcpNoDelay());
    }

    @Test
    @DisplayName("redissonCustomizer: Jackson 3 codec should round-trip typed values")
    void redissonCustomizerShouldUseJackson3CodecForRoundTrip() throws Exception {
        RedisConfig redisConfig = new RedisConfig();
        ReflectionTestUtils.setField(redisConfig, "redissonProperties", buildSingleServerProperties());

        Config config = new Config();
        try (MockedStatic<SpringUtils> springUtils = mockStatic(SpringUtils.class)) {
            springUtils.when(SpringUtils::isVirtual).thenReturn(false);
            redisConfig.redissonCustomizer().customize(config);
        }

        Codec codec = config.getCodec();
        ByteBuf encoded = codec.getValueEncoder().encode(new CodecPayload("alice", 2));
        try {
            Object decoded = codec.getValueDecoder().decode(encoded, null);
            assertInstanceOf(CodecPayload.class, decoded);
            assertEquals("alice", ((CodecPayload) decoded).getName());
            assertEquals(2, ((CodecPayload) decoded).getCount());
        } finally {
            encoded.release();
        }
    }

    static class CodecPayload {
        private String name;
        private int count;

        CodecPayload() {
        }

        CodecPayload(String name, int count) {
            this.name = name;
            this.count = count;
        }

        public String getName() {
            return name;
        }

        public int getCount() {
            return count;
        }
    }

    @Test
    @DisplayName("redissonCustomizer: should apply cluster settings when virtual threads are disabled")
    void redissonCustomizerShouldApplyClusterSettings() {
        RedisConfig redisConfig = new RedisConfig();
        ReflectionTestUtils.setField(redisConfig, "redissonProperties", buildClusterProperties());

        Config config = new Config();
        try (MockedStatic<SpringUtils> springUtils = mockStatic(SpringUtils.class)) {
            springUtils.when(SpringUtils::isVirtual).thenReturn(false);
            redisConfig.redissonCustomizer().customize(config);
        }

        ClusterServersConfig cluster = (ClusterServersConfig) ReflectionTestUtils.getField(config, "clusterServersConfig");
        assertNotNull(cluster);
        assertEquals("cluster-client", cluster.getClientName());
        assertEquals(9000, cluster.getConnectTimeout());
        assertEquals(35000, cluster.getPingConnectionInterval());
        assertInstanceOf(KeyPrefixHandler.class, config.getNameMapper());
        assertEquals(true, config.isTcpKeepAlive());
        assertEquals(true, config.isTcpNoDelay());
    }

    @Test
    @DisplayName("redissonCustomizer: should support virtual threads on JDK21+")
    void redissonCustomizerShouldSupportVirtualThreadsOnJdk21() {
        RedisConfig redisConfig = new RedisConfig();
        ReflectionTestUtils.setField(redisConfig, "redissonProperties", buildClusterProperties());

        Config config = new Config();
        try (MockedStatic<SpringUtils> springUtils = mockStatic(SpringUtils.class)) {
            springUtils.when(SpringUtils::isVirtual).thenReturn(true);
            // JDK 21+ 原生支持虚拟线程，不应该抛出异常
            assertDoesNotThrow(() -> redisConfig.redissonCustomizer().customize(config));
        }
    }

    @Test
    @DisplayName("redisExceptionHandler: should create redis exception handler bean")
    void redisExceptionHandlerShouldBeCreated() {
        RedisConfig redisConfig = new RedisConfig();
        assertInstanceOf(RedisExceptionHandler.class, redisConfig.redisExceptionHandler());
    }

    private static RedissonProperties buildSingleServerProperties() {
        RedissonProperties properties = new RedissonProperties();
        properties.setKeyPrefix("infoq");
        properties.setThreads(4);
        properties.setNettyThreads(8);

        RedissonProperties.SingleServerConfig single = new RedissonProperties.SingleServerConfig();
        single.setClientName("single-client");
        single.setConnectionMinimumIdleSize(1);
        single.setConnectionPoolSize(2);
        single.setIdleConnectionTimeout(5000);
        single.setTimeout(3000);
        single.setConnectTimeout(10000);
        single.setPingConnectionInterval(30000);
        single.setKeepAlive(true);
        single.setTcpNoDelay(true);
        single.setSubscriptionConnectionPoolSize(3);
        properties.setSingleServerConfig(single);
        return properties;
    }

    private static RedissonProperties buildClusterProperties() {
        RedissonProperties properties = new RedissonProperties();
        properties.setKeyPrefix("cluster");
        properties.setThreads(6);
        properties.setNettyThreads(10);

        RedissonProperties.ClusterServersConfig cluster = new RedissonProperties.ClusterServersConfig();
        cluster.setClientName("cluster-client");
        cluster.setMasterConnectionMinimumIdleSize(2);
        cluster.setMasterConnectionPoolSize(4);
        cluster.setSlaveConnectionMinimumIdleSize(2);
        cluster.setSlaveConnectionPoolSize(4);
        cluster.setIdleConnectionTimeout(6000);
        cluster.setTimeout(4000);
        cluster.setConnectTimeout(9000);
        cluster.setPingConnectionInterval(35000);
        cluster.setKeepAlive(true);
        cluster.setTcpNoDelay(true);
        cluster.setSubscriptionConnectionPoolSize(5);
        cluster.setReadMode(ReadMode.SLAVE);
        cluster.setSubscriptionMode(SubscriptionMode.MASTER);
        properties.setClusterServersConfig(cluster);
        return properties;
    }
}
