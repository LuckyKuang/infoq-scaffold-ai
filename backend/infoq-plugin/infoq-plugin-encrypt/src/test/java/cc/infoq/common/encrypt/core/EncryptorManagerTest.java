package cc.infoq.common.encrypt.core;

import cc.infoq.common.constant.Constants;
import cc.infoq.common.encrypt.fixture.ScanEncryptEntity;
import cc.infoq.common.encrypt.enumd.AlgorithmType;
import cc.infoq.common.encrypt.enumd.EncodeType;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Tag("dev")
class EncryptorManagerTest {

    @Test
    @DisplayName("constructor scan: should cache fields annotated by EncryptField")
    void constructorScanShouldCacheAnnotatedFields() {
        EncryptorManager manager = new EncryptorManager("cc.infoq.common.encrypt.fixture");

        Set<Field> fields = manager.getFieldCache(ScanEncryptEntity.class);

        assertNotNull(fields);
        assertEquals(1, fields.size());
        Field field = fields.iterator().next();
        assertEquals("secret", field.getName());
        assertTrue(field.canAccess(new ScanEncryptEntity()));
    }

    @Test
    @DisplayName("encrypt/decrypt: should reuse cached encryptor and round-trip payload")
    void encryptDecryptShouldReuseCachedEncryptorAndRoundTripPayload() {
        EncryptorManager manager = new EncryptorManager();
        EncryptContext context = buildBase64Context();

        IEncryptor first = manager.registAndGetEncryptor(context);
        IEncryptor second = manager.registAndGetEncryptor(context);
        assertSame(first, second);

        String encrypted = manager.encrypt("hello", context);
        assertTrue(encrypted.startsWith(Constants.ENCRYPT_HEADER));
        assertEquals("hello", manager.decrypt(encrypted, context));

        String alreadyEncrypted = Constants.ENCRYPT_HEADER + "already";
        assertEquals(alreadyEncrypted, manager.encrypt(alreadyEncrypted, context));
        assertEquals("plain", manager.decrypt("plain", context));

        manager.removeEncryptor(context);
        IEncryptor third = manager.registAndGetEncryptor(context);
        assertNotSame(first, third);
    }

    @Test
    @DisplayName("getEncryptFieldSetFromClazz: should skip interface/member class")
    void getEncryptFieldSetFromClazzShouldSkipUnsupportedClassTypes() throws Exception {
        EncryptorManager manager = new EncryptorManager();
        Method method = EncryptorManager.class.getDeclaredMethod("getEncryptFieldSetFromClazz", Class.class);
        method.setAccessible(true);

        Object fromInterface = method.invoke(manager, Marker.class);
        Object fromMemberClass = method.invoke(manager, Holder.Member.class);

        assertTrue(fromInterface instanceof Set<?> interfaceSet && interfaceSet.isEmpty());
        assertTrue(fromMemberClass instanceof Set<?> memberClassSet && memberClassSet.isEmpty());
    }

    private static EncryptContext buildBase64Context() {
        EncryptContext context = new EncryptContext();
        context.setAlgorithm(AlgorithmType.BASE64);
        context.setEncode(EncodeType.BASE64);
        context.setPassword("ignored");
        context.setPrivateKey("ignored");
        context.setPublicKey("ignored");
        return context;
    }

    private interface Marker {
    }

    private static class Holder {
        private static class Member {
        }
    }
}
