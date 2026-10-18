package cc.infoq.common.redis.config;

import cc.infoq.common.redis.aspectj.RepeatSubmitAspect;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertInstanceOf;

@Tag("dev")
class IdempotentConfigTest {

    @Test
    @DisplayName("repeatSubmitAspect: should create repeat submit aspect bean")
    void repeatSubmitAspectShouldBeCreated() {
        IdempotentConfig config = new IdempotentConfig();
        assertInstanceOf(RepeatSubmitAspect.class, config.repeatSubmitAspect());
    }
}
