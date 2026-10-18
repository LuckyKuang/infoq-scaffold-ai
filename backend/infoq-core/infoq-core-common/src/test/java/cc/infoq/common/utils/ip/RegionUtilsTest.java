package cc.infoq.common.utils.ip;

import cn.hutool.core.io.resource.ResourceUtil;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import org.lionsoul.ip2region.service.Config;
import org.lionsoul.ip2region.service.ConfigBuilder;
import org.lionsoul.ip2region.service.Ip2Region;
import org.mockito.MockedStatic;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.lang.reflect.Field;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.*;

@Tag("dev")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class RegionUtilsTest {

    @Test
    @Order(1)
    @DisplayName("getRegion/close: should cover fallback and close branches with mocked engine")
    void getRegionAndCloseShouldCoverBranches(@TempDir Path tempDir) throws Exception {
        Ip2Region ip2Region = mock(Ip2Region.class);
        byte[] ipOk = new byte[] {1, 2, 3, 4};
        byte[] ipBlank = new byte[] {2, 3, 4, 5};
        byte[] ipError = new byte[] {3, 4, 5, 6};
        Path ipv6XdbPath = tempDir.resolve("ip2region_v6.xdb");
        Files.write(ipv6XdbPath, new byte[] {2});
        System.setProperty(RegionUtils.IPV6_XDB_PATH_PROPERTY, ipv6XdbPath.toString());

        when(ip2Region.search("1.1.1.1")).thenReturn("CN");
        when(ip2Region.search("blank")).thenReturn(" ");
        when(ip2Region.search("boom")).thenThrow(new RuntimeException("query failed"));
        when(ip2Region.search(ipOk)).thenReturn("BYTE_CN");
        when(ip2Region.search(ipBlank)).thenReturn("");
        when(ip2Region.search(ipError)).thenThrow(new RuntimeException("query byte failed"));
        doThrow(new RuntimeException("close failed")).when(ip2Region).close(10000L);

        ConfigBuilder v4Builder = mock(ConfigBuilder.class);
        ConfigBuilder v6Builder = mock(ConfigBuilder.class);
        Config v4Config = mock(Config.class);
        Config v6Config = mock(Config.class);
        when(v4Builder.setCachePolicy(anyInt())).thenReturn(v4Builder);
        when(v4Builder.setXdbInputStream(any(InputStream.class))).thenReturn(v4Builder);
        when(v4Builder.setCacheSliceBytes(anyInt())).thenReturn(v4Builder);
        when(v4Builder.asV4()).thenReturn(v4Config);
        when(v6Builder.setCachePolicy(anyInt())).thenReturn(v6Builder);
        when(v6Builder.setXdbPath(any(String.class))).thenReturn(v6Builder);
        when(v6Builder.asV6()).thenReturn(v6Config);

        try {
            try (MockedStatic<ResourceUtil> resourceUtil = mockStatic(ResourceUtil.class);
                 MockedStatic<Config> configStatic = mockStatic(Config.class);
                 MockedStatic<Ip2Region> ip2RegionStatic = mockStatic(Ip2Region.class, invocation -> {
                     if ("create".equals(invocation.getMethod().getName())) {
                         return ip2Region;
                     }
                     return invocation.callRealMethod();
                 })) {
                resourceUtil.when(() -> ResourceUtil.getStream("ip2region_v4.xdb"))
                    .thenReturn(new ByteArrayInputStream(new byte[] {1}));
                configStatic.when(Config::custom).thenReturn(v4Builder, v6Builder);
                assertSame(ip2Region, Ip2Region.create((Config) null, (Config) null));

                RegionUtils instance = new RegionUtils();
                assertNotNull(instance);

                assertEquals("CN", RegionUtils.getRegion("1.1.1.1"));
                assertEquals(RegionUtils.UNKNOWN_ADDRESS, RegionUtils.getRegion("blank"));
                assertEquals(RegionUtils.UNKNOWN_ADDRESS, RegionUtils.getRegion("boom"));

                assertEquals("BYTE_CN", RegionUtils.getRegion(ipOk));
                assertEquals(RegionUtils.UNKNOWN_ADDRESS, RegionUtils.getRegion(ipBlank));
                assertEquals(RegionUtils.UNKNOWN_ADDRESS, RegionUtils.getRegion(ipError));

                assertDoesNotThrow(() -> RegionUtils.close(Duration.ofMillis(7)));
                assertDoesNotThrow(() -> RegionUtils.close());
                assertDoesNotThrow(() -> RegionUtils.close(null));

                verify(ip2Region).close(7L);
                verify(ip2Region, atLeast(2)).close(10000L);
                verify(v6Builder).setCachePolicy(Config.VIndexCache);
                verify(v6Builder).setXdbPath(ipv6XdbPath.toString());

                Field ip2RegionField = RegionUtils.class.getDeclaredField("ip2Region");
                ip2RegionField.setAccessible(true);
                Object original = ip2RegionField.get(null);
                ip2RegionField.set(null, null);
                try {
                    assertDoesNotThrow(() -> RegionUtils.close());
                    assertDoesNotThrow(() -> RegionUtils.close(Duration.ofSeconds(1)));
                } finally {
                    ip2RegionField.set(null, original);
                }
            }
        } finally {
            System.clearProperty(RegionUtils.IPV6_XDB_PATH_PROPERTY);
        }
    }

    @Test
    @Order(2)
    @DisplayName("buildIpv6Config: should skip IPv6 when external path is blank")
    void buildIpv6ConfigShouldSkipBlankPath() throws Exception {
        assertNull(RegionUtils.buildIpv6Config(" "));
    }

    @Test
    @Order(3)
    @DisplayName("buildIpv6Config: should fail when configured external path is missing")
    void buildIpv6ConfigShouldRejectMissingFile(@TempDir Path tempDir) {
        Path missingPath = tempDir.resolve("missing-ip2region_v6.xdb");

        IllegalStateException exception = assertThrows(IllegalStateException.class,
            () -> RegionUtils.buildIpv6Config(missingPath.toString()));

        assertEquals("IPv6地址库文件不存在：" + missingPath.toAbsolutePath().normalize(), exception.getMessage());
    }

    @Test
    @Order(4)
    @DisplayName("resolveExternalIpv6XdbPath: should prefer trimmed JVM property")
    void resolveExternalIpv6XdbPathShouldPreferSystemProperty() {
        try {
            System.setProperty(RegionUtils.IPV6_XDB_PATH_PROPERTY, "  /tmp/ip2region_v6.xdb  ");

            assertEquals("/tmp/ip2region_v6.xdb", RegionUtils.resolveExternalIpv6XdbPath());
        } finally {
            System.clearProperty(RegionUtils.IPV6_XDB_PATH_PROPERTY);
        }
    }
}
