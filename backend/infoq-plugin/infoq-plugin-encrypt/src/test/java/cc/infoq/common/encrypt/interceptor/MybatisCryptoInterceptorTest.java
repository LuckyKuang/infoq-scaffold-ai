package cc.infoq.common.encrypt.interceptor;

import cc.infoq.common.encrypt.annotation.EncryptField;
import cc.infoq.common.encrypt.core.EncryptContext;
import cc.infoq.common.encrypt.core.EncryptorManager;
import cc.infoq.common.encrypt.enumd.AlgorithmType;
import cc.infoq.common.encrypt.enumd.EncodeType;
import cc.infoq.common.encrypt.properties.EncryptorProperties;
import org.apache.ibatis.executor.parameter.ParameterHandler;
import org.apache.ibatis.executor.resultset.ResultSetHandler;
import org.apache.ibatis.plugin.Invocation;
import org.apache.ibatis.cursor.Cursor;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.sql.CallableStatement;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.sql.Statement;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@Tag("dev")
class MybatisCryptoInterceptorTest {

    @Test
    @DisplayName("encrypt interceptor: should encrypt map/list/object payload and pass through plugin")
    void encryptInterceptorShouldEncryptPayload() throws Exception {
        EncryptorManager manager = mock(EncryptorManager.class);
        EncryptorProperties properties = defaultProperties();
        Set<Field> fields = encryptedFields();
        when(manager.getFieldCache(SamplePayload.class)).thenReturn(fields);
        when(manager.encrypt(anyString(), any(EncryptContext.class)))
            .thenAnswer(invocation -> "enc(" + invocation.getArgument(0) + ")");

        MybatisEncryptInterceptor interceptor = new MybatisEncryptInterceptor(manager, properties);
        Method encryptHandler = MybatisEncryptInterceptor.class.getDeclaredMethod("encryptHandler", Object.class);
        encryptHandler.setAccessible(true);

        SamplePayload payload = new SamplePayload();
        Map<String, Object> map = new HashMap<>();
        map.put("k", payload);
        encryptHandler.invoke(interceptor, map);
        assertEquals("enc(plain)", payload.secret);
        assertEquals("enc(custom)", payload.customSecret);

        SamplePayload payload2 = new SamplePayload();
        encryptHandler.invoke(interceptor, java.util.List.of(payload2));
        assertEquals("enc(plain)", payload2.secret);
        assertEquals("enc(custom)", payload2.customSecret);

        ParameterHandler parameterHandler = mock(ParameterHandler.class);
        when(parameterHandler.getParameterObject()).thenReturn(new SamplePayload());
        Object pluginTarget = interceptor.plugin(parameterHandler);
        assertSame(parameterHandler, pluginTarget);
        Invocation invocation = mock(Invocation.class);
        try {
            assertSame(invocation, interceptor.intercept(invocation));
        } catch (Throwable throwable) {
            fail(throwable);
        }
        interceptor.setProperties(new Properties());
        verify(manager, atLeastOnce()).encrypt(anyString(), any(EncryptContext.class));
    }

    @Test
    @DisplayName("decrypt interceptor: should decrypt map/list/object payload and return wrapped plugin")
    void decryptInterceptorShouldDecryptPayload() throws Exception {
        EncryptorManager manager = mock(EncryptorManager.class);
        EncryptorProperties properties = defaultProperties();
        Set<Field> fields = encryptedFields();
        when(manager.getFieldCache(SamplePayload.class)).thenReturn(fields);
        when(manager.decrypt(anyString(), any(EncryptContext.class)))
            .thenAnswer(invocation -> "dec(" + invocation.getArgument(0) + ")");

        MybatisDecryptInterceptor interceptor = new MybatisDecryptInterceptor(manager, properties);
        Method decryptHandler = MybatisDecryptInterceptor.class.getDeclaredMethod("decryptHandler", Object.class);
        decryptHandler.setAccessible(true);

        SamplePayload payload = new SamplePayload();
        Map<String, Object> map = new HashMap<>();
        map.put("k", payload);
        decryptHandler.invoke(interceptor, map);
        assertEquals("dec(plain)", payload.secret);
        assertEquals("dec(custom)", payload.customSecret);

        SamplePayload payload2 = new SamplePayload();
        decryptHandler.invoke(interceptor, java.util.List.of(payload2));
        assertEquals("dec(plain)", payload2.secret);
        assertEquals("dec(custom)", payload2.customSecret);

        ResultSetHandler resultSetHandler = mock(ResultSetHandler.class);
        Object pluginTarget = interceptor.plugin(resultSetHandler);
        assertNotNull(pluginTarget);
        interceptor.setProperties(new Properties());
        verify(manager, atLeastOnce()).decrypt(anyString(), any(EncryptContext.class));
    }

    @Test
    @DisplayName("decrypt interceptor intercept: should decrypt parameter object and query result")
    void decryptInterceptorInterceptShouldDecryptParameterAndResult() throws Throwable {
        EncryptorManager manager = mock(EncryptorManager.class);
        EncryptorProperties properties = defaultProperties();
        Set<Field> fields = encryptedFields();
        when(manager.getFieldCache(SamplePayload.class)).thenReturn(fields);
        when(manager.decrypt(anyString(), any(EncryptContext.class)))
            .thenAnswer(invocation -> "dec(" + invocation.getArgument(0) + ")");

        MybatisDecryptInterceptor interceptor = new MybatisDecryptInterceptor(manager, properties);
        SamplePayload parameter = new SamplePayload();
        SamplePayload row = new SamplePayload();
        List<SamplePayload> rows = List.of(row);
        DemoResultSetHandler target = new DemoResultSetHandler(new DemoParameterHandler(parameter), rows);
        Invocation invocation = new Invocation(
            target,
            ResultSetHandler.class.getMethod("handleResultSets", Statement.class),
            new Object[]{mock(Statement.class)}
        );

        Object result = interceptor.intercept(invocation);

        assertSame(rows, result);
        assertEquals("dec(plain)", parameter.secret);
        assertEquals("dec(custom)", parameter.customSecret);
        assertEquals("dec(plain)", row.secret);
        assertEquals("dec(custom)", row.customSecret);

        target.result = null;
        Object nullResult = interceptor.intercept(invocation);
        assertNull(nullResult);
    }

    @Test
    @DisplayName("encrypt/decrypt field: should build context from annotation and default properties")
    void encryptDecryptFieldShouldBuildContextFromAnnotationAndDefaultProperties() throws Exception {
        EncryptorManager manager = mock(EncryptorManager.class);
        EncryptorProperties properties = defaultProperties();
        when(manager.encrypt(anyString(), any(EncryptContext.class))).thenReturn("enc");
        when(manager.decrypt(anyString(), any(EncryptContext.class))).thenReturn("dec");

        MybatisEncryptInterceptor encryptInterceptor = new MybatisEncryptInterceptor(manager, properties);
        MybatisDecryptInterceptor decryptInterceptor = new MybatisDecryptInterceptor(manager, properties);

        Method encryptField = MybatisEncryptInterceptor.class.getDeclaredMethod("encryptField", String.class, Field.class);
        Method decryptField = MybatisDecryptInterceptor.class.getDeclaredMethod("decryptField", String.class, Field.class);
        encryptField.setAccessible(true);
        decryptField.setAccessible(true);

        Field defaultField = SamplePayload.class.getDeclaredField("secret");
        Field customField = SamplePayload.class.getDeclaredField("customSecret");

        encryptField.invoke(encryptInterceptor, "abc", defaultField);
        ArgumentCaptor<EncryptContext> encryptCaptor = ArgumentCaptor.forClass(EncryptContext.class);
        verify(manager).encrypt(anyString(), encryptCaptor.capture());
        EncryptContext defaultContext = encryptCaptor.getValue();
        assertEquals(AlgorithmType.BASE64, defaultContext.getAlgorithm());
        assertEquals(EncodeType.BASE64, defaultContext.getEncode());
        assertEquals("default-pass", defaultContext.getPassword());

        encryptField.invoke(encryptInterceptor, "abc", customField);
        verify(manager, atLeastOnce()).encrypt(anyString(), any(EncryptContext.class));

        decryptField.invoke(decryptInterceptor, "abc", defaultField);
        ArgumentCaptor<EncryptContext> decryptCaptor = ArgumentCaptor.forClass(EncryptContext.class);
        verify(manager).decrypt(anyString(), decryptCaptor.capture());
        EncryptContext decryptDefaultContext = decryptCaptor.getValue();
        assertEquals(AlgorithmType.BASE64, decryptDefaultContext.getAlgorithm());

        decryptField.invoke(decryptInterceptor, "abc", customField);
        verify(manager, atLeastOnce()).decrypt(anyString(), any(EncryptContext.class));
    }

    private static EncryptorProperties defaultProperties() {
        EncryptorProperties properties = new EncryptorProperties();
        properties.setAlgorithm(AlgorithmType.BASE64);
        properties.setEncode(EncodeType.BASE64);
        properties.setPassword("default-pass");
        properties.setPrivateKey("default-private");
        properties.setPublicKey("default-public");
        return properties;
    }

    private static Set<Field> encryptedFields() throws Exception {
        Field secret = SamplePayload.class.getDeclaredField("secret");
        Field customSecret = SamplePayload.class.getDeclaredField("customSecret");
        secret.setAccessible(true);
        customSecret.setAccessible(true);
        return Set.of(secret, customSecret);
    }

    private static class SamplePayload {

        @EncryptField
        private String secret = "plain";

        @EncryptField(
            algorithm = AlgorithmType.BASE64,
            encode = EncodeType.HEX,
            password = "custom-pass",
            privateKey = "custom-private",
            publicKey = "custom-public"
        )
        private String customSecret = "custom";
    }

    private static class DemoParameterHandler implements ParameterHandler {

        private final Object parameterObject;

        private DemoParameterHandler(Object parameterObject) {
            this.parameterObject = parameterObject;
        }

        @Override
        public Object getParameterObject() {
            return parameterObject;
        }

        @Override
        public void setParameters(java.sql.PreparedStatement ps) {
        }
    }

    @SuppressWarnings("unchecked")
    private static class DemoResultSetHandler implements ResultSetHandler {

        private final ParameterHandler parameterHandler;
        private List<SamplePayload> result;

        private DemoResultSetHandler(ParameterHandler parameterHandler, List<SamplePayload> result) {
            this.parameterHandler = parameterHandler;
            this.result = result;
        }

        @Override
        public List<SamplePayload> handleResultSets(Statement stmt) {
            return result;
        }

        @Override
        public <E> Cursor<E> handleCursorResultSets(Statement stmt) {
            return null;
        }

        @Override
        public void handleOutputParameters(CallableStatement cs) {
        }
    }
}
