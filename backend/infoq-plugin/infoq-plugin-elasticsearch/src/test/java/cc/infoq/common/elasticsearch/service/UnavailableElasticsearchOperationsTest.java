package cc.infoq.common.elasticsearch.service;

import cc.infoq.common.elasticsearch.ElasticsearchDocument;
import cc.infoq.common.elasticsearch.ElasticsearchIndexDefinition;
import cc.infoq.common.elasticsearch.ElasticsearchUnavailableException;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@Tag("dev")
class UnavailableElasticsearchOperationsTest {

    @Test
    void shouldFailEveryOperationWithoutPretendingThePluginIsAvailable() {
        UnavailableElasticsearchOperations operations = new UnavailableElasticsearchOperations(new ElasticsearchPluginMonitor());
        ElasticsearchIndexDefinition definition = new ElasticsearchIndexDefinition("system-message-v1", Map.of(), Map.of());
        ElasticsearchDocument document = new ElasticsearchDocument("system-message-v1", "1", Map.of("title", "message"));

        assertAll(
            () -> assertThrows(ElasticsearchUnavailableException.class, () -> operations.createIndex(definition)),
            () -> assertThrows(ElasticsearchUnavailableException.class, () -> operations.deleteIndex("system-message-v1")),
            () -> assertThrows(ElasticsearchUnavailableException.class,
                () -> operations.bindAlias("system-message", "system-message-v1")),
            () -> assertThrows(ElasticsearchUnavailableException.class,
                () -> operations.switchAlias("system-message", "system-message-v1", "system-message-v2")),
            () -> assertThrows(ElasticsearchUnavailableException.class, () -> operations.bulkIndex(List.of(document)))
        );

        assertFalse(operations.status().available());
        assertEquals(0, operations.status().successfulOperations());
        assertEquals(0, operations.status().operationFailures());
    }
}
