package cc.infoq.common.sensitive.core;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Tag("dev")
class SensitiveStrategyTest {

    @Test
    @DisplayName("desensitizer: should return expected nullability for all strategies")
    void desensitizerShouldReturnExpectedNullabilityForAllStrategies() {
        for (SensitiveStrategy strategy : SensitiveStrategy.values()) {
            String result = strategy.desensitizer().apply("13800138000");
            if (strategy == SensitiveStrategy.CLEAR_TO_NULL) {
                assertNull(result);
            } else {
                assertNotNull(result);
            }
        }
    }

    @Test
    @DisplayName("STRING_MASK and MASK_HIGH_SECURITY: should keep visible head/tail")
    void maskStrategiesShouldKeepVisibleHeadAndTail() {
        String stringMask = SensitiveStrategy.STRING_MASK.desensitizer().apply("abcd1234wxyz");
        String highSecurityMask = SensitiveStrategy.MASK_HIGH_SECURITY.desensitizer().apply("ab123456yz");

        assertEquals("abcd****wxyz", stringMask);
        assertTrue(highSecurityMask.startsWith("ab"));
        assertTrue(highSecurityMask.endsWith("yz"));
        assertTrue(highSecurityMask.contains("*"));
    }
}

