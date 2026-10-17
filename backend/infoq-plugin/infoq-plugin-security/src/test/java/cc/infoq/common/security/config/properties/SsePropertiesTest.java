package cc.infoq.common.security.config.properties;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

@Tag("dev")
class SsePropertiesTest {

    @Test
    @DisplayName("properties: should store sse path")
    void shouldStoreSsePath() {
        SseProperties properties = new SseProperties();

        properties.setPath("/sse/connect");

        assertEquals("/sse/connect", properties.getPath());
    }
}
