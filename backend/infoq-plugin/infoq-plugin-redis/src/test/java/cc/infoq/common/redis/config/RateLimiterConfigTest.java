package cc.infoq.common.redis.config;

import cc.infoq.common.redis.aspectj.RateLimiterAspect;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertInstanceOf;

@Tag("dev")
class RateLimiterConfigTest {

    @Test
    @DisplayName("rateLimiterAspect: should create rate limiter aspect bean")
    void rateLimiterAspectShouldBeCreated() {
        RateLimiterConfig config = new RateLimiterConfig();
        assertInstanceOf(RateLimiterAspect.class, config.rateLimiterAspect());
    }
}
