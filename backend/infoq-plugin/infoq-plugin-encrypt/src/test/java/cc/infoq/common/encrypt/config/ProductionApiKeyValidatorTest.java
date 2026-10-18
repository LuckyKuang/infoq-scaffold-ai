package cc.infoq.common.encrypt.config;

import cc.infoq.common.encrypt.properties.ApiDecryptProperties;
import cc.infoq.common.encrypt.utils.EncryptUtils;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

import java.security.KeyPairGenerator;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.*;

@Tag("dev")
class ProductionApiKeyValidatorTest {
    @Test void productionAcceptsIndependentStrongKeysAndRejectsWeakMalformedOrMissingKeys() throws Exception {
        var generator = KeyPairGenerator.getInstance("RSA"); generator.initialize(2048);
        var request = generator.generateKeyPair(); var response = generator.generateKeyPair();
        var properties = new ApiDecryptProperties();
        properties.setPrivateKey(Base64.getEncoder().encodeToString(request.getPrivate().getEncoded()));
        properties.setPublicKey(Base64.getEncoder().encodeToString(response.getPublic().getEncoded()));
        var environment = new MockEnvironment(); environment.setActiveProfiles("prod");
        var validator = new ApiDecryptAutoConfiguration().productionApiKeyValidator(properties, environment);
        assertDoesNotThrow(validator::afterPropertiesSet);
        String payload = "fixture-symmetric-key";
        assertEquals(payload, EncryptUtils.decryptByRsa(EncryptUtils.encryptByRsa(payload,
            Base64.getEncoder().encodeToString(request.getPublic().getEncoded())), properties.getPrivateKey()));
        assertEquals(payload, EncryptUtils.decryptByRsa(EncryptUtils.encryptByRsa(payload, properties.getPublicKey()),
            Base64.getEncoder().encodeToString(response.getPrivate().getEncoded())));
        generator.initialize(1024);
        properties.setPrivateKey(Base64.getEncoder().encodeToString(generator.generateKeyPair().getPrivate().getEncoded()));
        IllegalStateException weak = assertThrows(IllegalStateException.class, validator::afterPropertiesSet);
        assertTrue(weak.getMessage().contains("private-key"));
        properties.setPrivateKey("private-secret-invalid");
        assertFalse(assertThrows(IllegalStateException.class, validator::afterPropertiesSet).getMessage().contains("private-secret-invalid"));
        properties.setPrivateKey(null);
        assertThrows(IllegalStateException.class, validator::afterPropertiesSet);
        String validPrivate = Base64.getEncoder().encodeToString(request.getPrivate().getEncoded());
        for (String invalid : new String[]{"-----BEGIN PRIVATE KEY-----\n" + validPrivate + "\n-----END PRIVATE KEY-----",
            validPrivate + "\n", " " + validPrivate, validPrivate + "\\n"}) {
            properties.setPrivateKey(invalid);
            assertThrows(IllegalStateException.class, validator::afterPropertiesSet);
        }
        properties.setPrivateKey(validPrivate);
        properties.setPublicKey(Base64.getEncoder().encodeToString(generator.generateKeyPair().getPublic().getEncoded()));
        assertTrue(assertThrows(IllegalStateException.class, validator::afterPropertiesSet).getMessage().contains("public-key"));
    }

    @Test void developmentExamplesRemainExplicitlyOutsideProductionValidation() {
        assertDoesNotThrow(() -> new ApiDecryptAutoConfiguration().productionApiKeyValidator(new ApiDecryptProperties(), new MockEnvironment()).afterPropertiesSet());
    }
}
