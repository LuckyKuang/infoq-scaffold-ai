package cc.infoq.common.encrypt.config;

import cc.infoq.common.encrypt.core.EncryptorManager;
import cc.infoq.common.encrypt.fixture.ScanEncryptEntity;
import cc.infoq.common.encrypt.interceptor.MybatisDecryptInterceptor;
import cc.infoq.common.encrypt.interceptor.MybatisEncryptInterceptor;
import cc.infoq.common.encrypt.properties.ApiDecryptProperties;
import cc.infoq.common.encrypt.properties.EncryptorProperties;
import com.baomidou.mybatisplus.autoconfigure.MybatisPlusProperties;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;

@Tag("dev")
class EncryptAutoConfigurationTest {

    @Test
    void encryptorAutoConfigurationShouldCreateExpectedBeans() {
        EncryptorProperties properties = new EncryptorProperties();
        properties.setPassword("1234567890abcdef");

        MybatisPlusProperties mybatisPlusProperties = new MybatisPlusProperties();
        mybatisPlusProperties.setTypeAliasesPackage("cc.infoq.common.encrypt.fixture");

        EncryptorAutoConfiguration configuration = new EncryptorAutoConfiguration();
        ReflectionTestUtils.setField(configuration, "properties", properties);

        EncryptorManager manager = configuration.encryptorManager(mybatisPlusProperties);
        assertNotNull(manager);
        assertNotNull(manager.getFieldCache(ScanEncryptEntity.class));

        MybatisEncryptInterceptor encryptInterceptor = configuration.mybatisEncryptInterceptor(manager);
        MybatisDecryptInterceptor decryptInterceptor = configuration.mybatisDecryptInterceptor(manager);
        assertInstanceOf(MybatisEncryptInterceptor.class, encryptInterceptor);
        assertInstanceOf(MybatisDecryptInterceptor.class, decryptInterceptor);
    }

    @Test
    void apiDecryptAutoConfigurationShouldCreateCryptoFilter() {
        ApiDecryptAutoConfiguration configuration = new ApiDecryptAutoConfiguration();
        ApiDecryptProperties properties = new ApiDecryptProperties();
        properties.setHeaderFlag("X-Encrypt-Flag");
        properties.setPrivateKey("private");
        properties.setPublicKey("public");

        assertNotNull(configuration.cryptoFilter(properties));
    }
}
