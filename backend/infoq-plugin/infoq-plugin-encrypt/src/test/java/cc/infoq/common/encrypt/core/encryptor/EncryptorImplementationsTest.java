package cc.infoq.common.encrypt.core.encryptor;

import cc.infoq.common.encrypt.core.EncryptContext;
import cc.infoq.common.encrypt.enumd.AlgorithmType;
import cc.infoq.common.encrypt.enumd.EncodeType;
import cc.infoq.common.encrypt.utils.EncryptUtils;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Tag("dev")
class EncryptorImplementationsTest {

    @Test
    void base64EncryptorShouldEncryptAndDecrypt() {
        Base64Encryptor encryptor = new Base64Encryptor(new EncryptContext());

        String encrypted = encryptor.encrypt("hello", EncodeType.BASE64);

        assertEquals(AlgorithmType.BASE64, encryptor.algorithm());
        assertNotEquals("hello", encrypted);
        assertEquals("hello", encryptor.decrypt(encrypted));
    }

    @Test
    void aesAndSm4EncryptorShouldSupportBase64AndHexBranch() {
        EncryptContext aesContext = new EncryptContext();
        aesContext.setPassword("1234567890abcdef");
        AesEncryptor aesEncryptor = new AesEncryptor(aesContext);

        String aesBase64 = aesEncryptor.encrypt("payload", EncodeType.BASE64);
        String aesHex = aesEncryptor.encrypt("payload", EncodeType.HEX);
        assertEquals(AlgorithmType.AES, aesEncryptor.algorithm());
        assertEquals("payload", aesEncryptor.decrypt(aesBase64));
        assertTrue(aesHex.length() > 10);

        EncryptContext sm4Context = new EncryptContext();
        sm4Context.setPassword("abcdef1234567890");
        Sm4Encryptor sm4Encryptor = new Sm4Encryptor(sm4Context);

        String sm4Base64 = sm4Encryptor.encrypt("payload", EncodeType.BASE64);
        String sm4Hex = sm4Encryptor.encrypt("payload", EncodeType.HEX);
        assertEquals(AlgorithmType.SM4, sm4Encryptor.algorithm());
        assertEquals("payload", sm4Encryptor.decrypt(sm4Base64));
        assertTrue(sm4Hex.length() > 10);
    }

    @Test
    void rsaAndSm2EncryptorShouldValidateKeysAndRoundTrip() {
        EncryptContext invalid = new EncryptContext();
        invalid.setPrivateKey("");
        invalid.setPublicKey("");
        assertThrows(IllegalArgumentException.class, () -> new RsaEncryptor(invalid));
        assertThrows(IllegalArgumentException.class, () -> new Sm2Encryptor(invalid));

        Map<String, String> rsaKey = EncryptUtils.generateRsaKey();
        EncryptContext rsaContext = new EncryptContext();
        rsaContext.setPrivateKey(rsaKey.get(EncryptUtils.PRIVATE_KEY));
        rsaContext.setPublicKey(rsaKey.get(EncryptUtils.PUBLIC_KEY));
        RsaEncryptor rsaEncryptor = new RsaEncryptor(rsaContext);

        String rsaCipher = rsaEncryptor.encrypt("payload", EncodeType.BASE64);
        String rsaHexCipher = rsaEncryptor.encrypt("payload", EncodeType.HEX);
        assertEquals(AlgorithmType.RSA, rsaEncryptor.algorithm());
        assertEquals("payload", rsaEncryptor.decrypt(rsaCipher));
        assertTrue(rsaHexCipher.length() > 10);

        Map<String, String> sm2Key = EncryptUtils.generateSm2Key();
        EncryptContext sm2Context = new EncryptContext();
        sm2Context.setPrivateKey(sm2Key.get(EncryptUtils.PRIVATE_KEY));
        sm2Context.setPublicKey(sm2Key.get(EncryptUtils.PUBLIC_KEY));
        Sm2Encryptor sm2Encryptor = new Sm2Encryptor(sm2Context);

        String sm2Cipher = sm2Encryptor.encrypt("payload", EncodeType.BASE64);
        String sm2HexCipher = sm2Encryptor.encrypt("payload", EncodeType.HEX);
        assertEquals(AlgorithmType.SM2, sm2Encryptor.algorithm());
        assertEquals("payload", sm2Encryptor.decrypt(sm2Cipher));
        assertTrue(sm2HexCipher.length() > 10);
    }
}
