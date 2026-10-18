package cc.infoq.common.translation.core.handler;

import cc.infoq.common.service.OssService;
import cc.infoq.common.translation.annotation.Translation;
import cc.infoq.common.translation.constant.TransConstant;
import cc.infoq.common.translation.core.impl.OssUrlTranslationImpl;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.module.SimpleModule;

import java.util.concurrent.Executors;
import java.util.stream.IntStream;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@Tag("dev")
class TranslationSerializationTest {
    @AfterEach void clear() { TranslationHandler.TRANSLATION_MAPPER.clear(); }

    private JsonMapper mapper() {
        SimpleModule module = new SimpleModule();
        module.setSerializerModifier(new TranslationBeanSerializerModifier());
        return JsonMapper.builder().addModule(module).build();
    }

    @Test
    void realJacksonKeepsFieldContextsAndNullMapperIndependentAcrossThreads() throws Exception {
        TranslationHandler.TRANSLATION_MAPPER.put("first", (key, other) -> "first:" + key + ":" + other);
        TranslationHandler.TRANSLATION_MAPPER.put("second", (key, other) -> "second:" + key + ":" + other);
        JsonMapper mapper = mapper();
        try (var executor = Executors.newFixedThreadPool(4)) {
            var futures = IntStream.range(0, 40).mapToObj(i -> executor.submit(() -> {
                var tree = mapper.readTree(mapper.writeValueAsString(new Fields("alpha", "beta")));
                assertEquals("first:alpha:A", tree.get("first").asString());
                assertEquals("second:beta:B", tree.get("second").asString());
                assertTrue(tree.get("empty").isNull());
                assertEquals("plain", tree.get("ordinary").asString());
            })).toList();
            for (var future : futures) future.get();
        }
    }

    @Test
    void actualOssTranslatorIsUsedAndDependencyFailuresStayPrivate() {
        OssService oss = mock(OssService.class);
        when(oss.selectUrlByIds("7")).thenReturn("https://oss.example.com/signed");
        TranslationHandler.TRANSLATION_MAPPER.put(TransConstant.OSS_ID_TO_URL, new OssUrlTranslationImpl(oss));
        JsonMapper mapper = mapper();
        assertEquals("https://oss.example.com/signed", mapper.readTree(mapper.writeValueAsString(new Avatar())).get("avatar").asString());
        when(oss.selectUrlByIds("7")).thenThrow(new IllegalStateException("secret-token-and-raw-value"));
        Logger logger = (Logger) LoggerFactory.getLogger(TranslationHandler.class);
        ListAppender<ILoggingEvent> appender = new ListAppender<>();
        appender.start();
        logger.addAppender(appender);
        try {
            RuntimeException failure = assertThrows(RuntimeException.class, () -> mapper.writeValueAsString(new Avatar()));
            assertFalse(failure.toString().contains("secret-token-and-raw-value"));
            assertTrue(failure.toString().contains("stage=translation"));
            assertTrue(appender.list.stream().anyMatch(event -> event.getFormattedMessage().contains("field:avatar")));
            assertTrue(appender.list.stream().allMatch(event -> event.getThrowableProxy() == null
                && !event.getFormattedMessage().contains("secret-token-and-raw-value")));
        } finally { logger.detachAppender(appender); appender.stop(); }
    }

    @Test
    void missingTranslatorAndInvalidMapperFailInsteadOfWritingRawData() {
        JsonMapper mapper = mapper();
        assertThrows(RuntimeException.class, () -> mapper.writeValueAsString(new Avatar()));
        TranslationHandler.TRANSLATION_MAPPER.put("first", (key, other) -> key);
        RuntimeException failure = assertThrows(RuntimeException.class, () -> mapper.writeValueAsString(new BrokenMapper()));
        assertTrue(failure.toString().contains("stage=mapper"));
        assertFalse(failure.toString().contains("private-source"));
    }

    public static class Fields {
        private final String source1;
        private final String source2;
        Fields(String source1, String source2) { this.source1 = source1; this.source2 = source2; }
        public String getSource1() { return source1; }
        public String getSource2() { return source2; }
        public String getEmptySource() { return null; }
        @Translation(type = "first", mapper = "source1", other = "A") public String first;
        @Translation(type = "second", mapper = "source2", other = "B") public String second;
        @Translation(type = "first", mapper = "emptySource") public String empty;
        public String ordinary = "plain";
    }
    public static class Avatar {
        @Translation(type = TransConstant.OSS_ID_TO_URL) public Long avatar = 7L;
    }
    public static class BrokenMapper {
        @Translation(type = "first", mapper = "missing") public String translated = "private-source";
    }
}
