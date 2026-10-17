package cc.infoq.common.elasticsearch;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@Tag("dev")
class ElasticsearchDocumentTest {

    @Test
    void shouldDefensivelyCopyDocumentSource() {
        Map<String, Object> source = new HashMap<>();
        source.put("title", "first");

        ElasticsearchDocument document = new ElasticsearchDocument("system-message", "1", source);
        source.put("title", "changed");

        assertEquals("first", document.source().get("title"));
    }

    @Test
    void shouldPreserveNullJsonFieldInImmutableSourceSnapshot() {
        Map<String, Object> source = new HashMap<>();
        source.put("deletedAt", null);

        ElasticsearchDocument document = new ElasticsearchDocument("system-message", "1", source);

        assertNull(document.source().get("deletedAt"));
        assertThrows(UnsupportedOperationException.class, () -> document.source().put("title", "message"));
    }

    @Test
    void shouldRejectBlankIndex() {
        assertThrows(IllegalArgumentException.class,
            () -> new ElasticsearchDocument(" ", "1", Map.of("title", "message")));
    }
}
