package cc.infoq.common.validate.dicts;

import cc.infoq.common.service.DictService;
import cc.infoq.common.utils.SpringUtils;
import org.springframework.context.support.GenericApplicationContext;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@Tag("dev")
class DictPatternValidatorTest {

    @Test
    @DisplayName("initialize/isValid: should use default separator when annotation separator is blank")
    void initializeAndIsValidShouldUseDefaultSeparatorWhenBlank() {
        DictPattern annotation = mock(DictPattern.class);
        when(annotation.dictType()).thenReturn("sys_yes_no");
        when(annotation.separator()).thenReturn("");
        DictService dictService = mock(DictService.class);
        when(dictService.getDictLabel("sys_yes_no", "1", ",")).thenReturn("是");
        DictPatternValidator validator = new DictPatternValidator();
        validator.initialize(annotation);
        GenericApplicationContext context = new GenericApplicationContext();
        context.registerBean(DictService.class, () -> dictService);
        context.refresh();
        new SpringUtils().setApplicationContext(context);

        try {
            assertTrue(validator.isValid("1", null));
            verify(dictService).getDictLabel("sys_yes_no", "1", ",");
        } finally {
            context.close();
        }
    }

    @Test
    @DisplayName("isValid: should return false for blank dict type or blank value")
    void isValidShouldReturnFalseForBlankDictTypeOrBlankValue() {
        DictPattern annotation = mock(DictPattern.class);
        when(annotation.dictType()).thenReturn("");
        when(annotation.separator()).thenReturn(",");
        DictPatternValidator validator = new DictPatternValidator();
        validator.initialize(annotation);

        assertFalse(validator.isValid("1", null));
        assertFalse(validator.isValid("", null));
    }

    @Test
    @DisplayName("isValid: should return false when dictionary lookup yields blank label")
    void isValidShouldReturnFalseWhenDictLabelIsBlank() {
        DictPattern annotation = mock(DictPattern.class);
        when(annotation.dictType()).thenReturn("sys_user_status");
        when(annotation.separator()).thenReturn(";");
        DictService dictService = mock(DictService.class);
        when(dictService.getDictLabel("sys_user_status", "X", ";")).thenReturn("");
        DictPatternValidator validator = new DictPatternValidator();
        validator.initialize(annotation);
        GenericApplicationContext context = new GenericApplicationContext();
        context.registerBean(DictService.class, () -> dictService);
        context.refresh();
        new SpringUtils().setApplicationContext(context);

        try {
            assertFalse(validator.isValid("X", null));
            verify(dictService).getDictLabel("sys_user_status", "X", ";");
        } finally {
            context.close();
        }
    }
}
