package cc.infoq.common.redis.handler;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

@Tag("dev")
class KeyPrefixHandlerTest {

    @Test
    @DisplayName("map/unmap: should add and remove configured prefix")
    void mapAndUnmapShouldAddAndRemoveConfiguredPrefix() {
        KeyPrefixHandler handler = new KeyPrefixHandler("prod");

        assertEquals("prod:token:1", handler.map("token:1"));
        assertEquals("token:1", handler.unmap("prod:token:1"));
    }

    @Test
    @DisplayName("map/unmap: should keep original key when already prefixed")
    void mapAndUnmapShouldKeepOriginalKeyWhenAlreadyPrefixed() {
        KeyPrefixHandler handler = new KeyPrefixHandler("prod");

        assertEquals("prod:user:1", handler.map("prod:user:1"));
        assertEquals("user:1", handler.unmap("prod:user:1"));
    }

    @Test
    @DisplayName("constructor/map/unmap: should handle blank prefix and blank key")
    void constructorMapAndUnmapShouldHandleBlankPrefixAndBlankKey() {
        KeyPrefixHandler handler = new KeyPrefixHandler("");

        assertEquals("user:1", handler.map("user:1"));
        assertEquals("user:1", handler.unmap("user:1"));
        assertNull(handler.map(""));
        assertNull(handler.unmap(" "));
    }
}
