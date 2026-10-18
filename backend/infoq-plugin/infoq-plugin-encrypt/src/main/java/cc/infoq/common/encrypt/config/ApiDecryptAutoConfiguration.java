package cc.infoq.common.encrypt.config;

import cc.infoq.common.encrypt.filter.CryptoFilter;
import cc.infoq.common.encrypt.properties.ApiDecryptProperties;
import jakarta.servlet.DispatcherType;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.web.servlet.FilterRegistration;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;

import java.security.KeyFactory;
import java.security.interfaces.RSAKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;

/**
 * api 解密自动配置
 *
 * @author Pontus
 */
@AutoConfiguration
@EnableConfigurationProperties(ApiDecryptProperties.class)
@ConditionalOnProperty(value = "api-decrypt.enabled", havingValue = "true")
public class ApiDecryptAutoConfiguration {

    @Bean
    public InitializingBean productionApiKeyValidator(ApiDecryptProperties properties, Environment environment) {
        return () -> {
            if (!environment.acceptsProfiles(Profiles.of("prod"))) return;
            for (String name : new String[]{"private-key", "public-key"}) {
                try {
                    String value = "private-key".equals(name) ? properties.getPrivateKey() : properties.getPublicKey();
                    if (value == null || !value.matches("[A-Za-z0-9+/]+={0,2}")) throw new IllegalArgumentException();
                    byte[] bytes = Base64.getDecoder().decode(value);
                    if (!Base64.getEncoder().encodeToString(bytes).equals(value)) throw new IllegalArgumentException();
                    KeyFactory factory = KeyFactory.getInstance("RSA");
                    RSAKey key = (RSAKey) ("private-key".equals(name) ? factory.generatePrivate(new PKCS8EncodedKeySpec(bytes))
                        : factory.generatePublic(new X509EncodedKeySpec(bytes)));
                    if (key.getModulus().bitLength() < 2048) throw new IllegalArgumentException();
                } catch (Exception e) {
                    throw new IllegalStateException("Production api-decrypt." + name + " must be a single-line Base64 DER RSA key of at least 2048 bits (private PKCS8/public SPKI)");
                }
            }
        };
    }

    @Bean
    @FilterRegistration(
        name = "cryptoFilter",
        urlPatterns = "/*",
        order = FilterRegistrationBean.HIGHEST_PRECEDENCE,
        dispatcherTypes = DispatcherType.REQUEST
    )
    public CryptoFilter cryptoFilter(ApiDecryptProperties properties) {
        return new CryptoFilter(properties);
    }

}
