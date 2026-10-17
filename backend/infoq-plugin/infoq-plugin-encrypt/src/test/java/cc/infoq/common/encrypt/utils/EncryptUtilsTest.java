package cc.infoq.common.encrypt.utils;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Tag("dev")
class EncryptUtilsTest {

    @Test
    @DisplayName("constructor: should allow utility class instantiation for coverage guard")
    void constructorShouldBeInvocable() {
        EncryptUtils utils = new EncryptUtils();
        assertNotNull(utils);
    }

    @Test
    @DisplayName("base64/aes/sm4: should encrypt and decrypt text correctly")
    void symmetricEncryptAndDecryptShouldWork() {
        String plain = "infoq-123";
        String aesKey = "1234567890abcdef";
        String sm4Key = "abcdef1234567890";

        String base64 = EncryptUtils.encryptByBase64(plain);
        assertNotEquals(plain, base64);
        assertEquals(plain, EncryptUtils.decryptByBase64(base64));

        String aes = EncryptUtils.encryptByAes(plain, aesKey);
        assertEquals(plain, EncryptUtils.decryptByAes(aes, aesKey));
        assertThrows(IllegalArgumentException.class, () -> EncryptUtils.encryptByAes(plain, "short"));

        String sm4 = EncryptUtils.encryptBySm4(plain, sm4Key);
        assertEquals(plain, EncryptUtils.decryptBySm4(sm4, sm4Key));
        assertThrows(IllegalArgumentException.class, () -> EncryptUtils.encryptBySm4(plain, "short"));
    }

    @Test
    @DisplayName("sm2/rsa: should generate key pair and decrypt encrypted payload")
    void asymmetricEncryptAndDecryptShouldWork() {
        String plain = "secure-payload";

        Map<String, String> sm2 = EncryptUtils.generateSm2Key();
        String sm2Cipher = EncryptUtils.encryptBySm2(plain, sm2.get(EncryptUtils.PUBLIC_KEY));
        assertEquals(plain, EncryptUtils.decryptBySm2(sm2Cipher, sm2.get(EncryptUtils.PRIVATE_KEY)));

        Map<String, String> rsa = EncryptUtils.generateRsaKey();
        String rsaCipher = EncryptUtils.encryptByRsa(plain, rsa.get(EncryptUtils.PUBLIC_KEY));
        assertEquals(plain, EncryptUtils.decryptByRsa(rsaCipher, rsa.get(EncryptUtils.PRIVATE_KEY)));
    }

    @Test
    @DisplayName("digest methods: should return non-empty hashes with expected lengths")
    void digestMethodsShouldReturnExpectedLength() {
        String plain = "digest-me";
        String md5 = EncryptUtils.encryptByMd5(plain);
        String sha256 = EncryptUtils.encryptBySha256(plain);
        String sm3 = EncryptUtils.encryptBySm3(plain);

        assertNotNull(md5);
        assertNotNull(sha256);
        assertNotNull(sm3);
        assertTrue(md5.length() >= 32);
        assertEquals(64, sha256.length());
        assertEquals(64, sm3.length());
    }
}
