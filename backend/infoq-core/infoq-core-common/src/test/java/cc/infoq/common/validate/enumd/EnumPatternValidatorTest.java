package cc.infoq.common.validate.enumd;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.lang.annotation.Annotation;
import java.lang.reflect.Proxy;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Tag("dev")
class EnumPatternValidatorTest {

    @Test
    @DisplayName("initialize/isValid: should match enum getter value")
    void initializeAndIsValidShouldMatchEnumGetterValue() {
        EnumPatternValidator validator = new EnumPatternValidator();

        validator.initialize(enumPattern());

        assertTrue(validator.isValid("1", null));
    }

    @Test
    @DisplayName("isValid: should return false for blank or unmatched value")
    void isValidShouldReturnFalseForBlankOrUnmatchedValue() {
        EnumPatternValidator validator = new EnumPatternValidator();
        validator.initialize(enumPattern());

        assertFalse(validator.isValid("", null));
        assertFalse(validator.isValid("9", null));
    }

    private static EnumPattern enumPattern() {
        return (EnumPattern) Proxy.newProxyInstance(
            EnumPattern.class.getClassLoader(),
            new Class<?>[]{EnumPattern.class},
            (proxy, method, args) -> {
                String name = method.getName();
                if ("type".equals(name)) {
                    return DemoStatus.class;
                }
                if ("fieldName".equals(name)) {
                    return "code";
                }
                if ("message".equals(name)) {
                    return "输入值不在枚举范围内";
                }
                if ("groups".equals(name)) {
                    return new Class<?>[0];
                }
                if ("payload".equals(name)) {
                    return new Class<?>[0];
                }
                if ("annotationType".equals(name)) {
                    return EnumPattern.class;
                }
                if ("toString".equals(name)) {
                    return EnumPattern.class.getName();
                }
                if ("hashCode".equals(name)) {
                    return EnumPattern.class.hashCode();
                }
                if ("equals".equals(name)) {
                    return proxy == args[0];
                }
                return method.getDefaultValue();
            }
        );
    }

    private enum DemoStatus {
        ENABLE("1"),
        DISABLE("0");

        private final String code;

        DemoStatus(String code) {
            this.code = code;
        }

        public String getCode() {
            return code;
        }
    }
}
