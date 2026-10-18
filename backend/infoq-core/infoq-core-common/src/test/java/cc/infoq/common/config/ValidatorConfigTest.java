package cc.infoq.common.config;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import jakarta.validation.constraints.NotBlank;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.context.support.StaticMessageSource;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

@Tag("dev")
class ValidatorConfigTest {

    @Test
    @DisplayName("validator: should build validator instance with fail-fast behavior")
    void validatorShouldBuildValidatorInstanceWithFailFastBehavior() {
        ValidatorConfig config = new ValidatorConfig();
        StaticMessageSource messageSource = new StaticMessageSource();
        Validator validator = config.validator(messageSource);

        Set<ConstraintViolation<DemoBean>> violations = validator.validate(new DemoBean("", ""));

        assertNotNull(validator);
        assertEquals(1, violations.size());
    }

    private static class DemoBean {

        @NotBlank
        private final String username;

        @NotBlank
        private final String password;

        private DemoBean(String username, String password) {
            this.username = username;
            this.password = password;
        }
    }
}
