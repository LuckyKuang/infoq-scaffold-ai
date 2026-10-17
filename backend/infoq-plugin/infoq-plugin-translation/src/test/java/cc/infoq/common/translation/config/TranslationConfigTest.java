package cc.infoq.common.translation.config;

import cc.infoq.common.service.DeptService;
import cc.infoq.common.translation.constant.TransConstant;
import cc.infoq.common.translation.core.TranslationInterface;
import cc.infoq.common.translation.core.handler.TranslationHandler;
import cc.infoq.common.translation.core.impl.DeptNameTranslationImpl;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

@Tag("dev")
class TranslationConfigTest {

    @AfterEach
    void clearMapper() {
        TranslationHandler.TRANSLATION_MAPPER.clear();
    }

    @Test
    @DisplayName("init: should register annotated translator and wire serializer modifier")
    void initShouldRegisterTranslatorAndWireSerializerModifier() {
        TranslationConfig config = new TranslationConfig();
        DeptService deptService = mock(DeptService.class);
        TranslationInterface<?> annotated = new DeptNameTranslationImpl(deptService);
        TranslationInterface<?> plain = (key, other) -> null;
        ObjectMapper mapper = new ObjectMapper();

        ReflectionTestUtils.setField(config, "list", List.of(annotated, plain));
        ReflectionTestUtils.setField(config, "objectMapper", mapper);

        config.init();

        assertTrue(TranslationHandler.TRANSLATION_MAPPER.containsKey(TransConstant.DEPT_ID_TO_NAME));
        assertNotNull(mapper.getSerializerFactory());
    }
}

