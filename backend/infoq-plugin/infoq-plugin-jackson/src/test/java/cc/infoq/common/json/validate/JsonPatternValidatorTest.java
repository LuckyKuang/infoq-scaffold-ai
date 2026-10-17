package cc.infoq.common.json.validate;

import cc.infoq.common.utils.SpringUtils;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.context.support.GenericApplicationContext;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@Tag("dev")
class JsonPatternValidatorTest {

    @BeforeAll
    static void initSpringContext() {
        GenericApplicationContext context = new GenericApplicationContext();
        context.registerBean(ObjectMapper.class, () -> new ObjectMapper());
        context.refresh();
        new SpringUtils().setApplicationContext(context);
    }

    @Test
    @DisplayName("isValid(ANY): should allow object/array and reject invalid json")
    void isValidAnyShouldAllowObjectArrayAndRejectInvalidJson() {
        JsonPatternValidator validator = new JsonPatternValidator();
        validator.initialize(annotation(JsonType.ANY));

        assertTrue(validator.isValid("{\"id\":1}", null));
        assertTrue(validator.isValid("[1,2,3]", null));
        assertTrue(validator.isValid("", null));
        assertFalse(validator.isValid("invalid-json", null));
    }

    @Test
    @DisplayName("isValid(OBJECT): should accept object and reject array")
    void isValidObjectShouldAcceptObjectAndRejectArray() {
        JsonPatternValidator validator = new JsonPatternValidator();
        validator.initialize(annotation(JsonType.OBJECT));

        assertTrue(validator.isValid("{\"k\":\"v\"}", null));
        assertFalse(validator.isValid("[{\"k\":\"v\"}]", null));
    }

    @Test
    @DisplayName("isValid(ARRAY): should accept array and reject object")
    void isValidArrayShouldAcceptArrayAndRejectObject() {
        JsonPatternValidator validator = new JsonPatternValidator();
        validator.initialize(annotation(JsonType.ARRAY));

        assertTrue(validator.isValid("[{\"k\":\"v\"}]", null));
        assertFalse(validator.isValid("{\"k\":\"v\"}", null));
    }

    private static JsonPattern annotation(JsonType type) {
        JsonPattern annotation = mock(JsonPattern.class);
        when(annotation.type()).thenReturn(type);
        return annotation;
    }
}
