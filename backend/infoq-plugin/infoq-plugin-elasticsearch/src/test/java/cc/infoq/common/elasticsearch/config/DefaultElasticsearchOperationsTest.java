package cc.infoq.common.elasticsearch.config;

import cc.infoq.common.elasticsearch.*;
import cc.infoq.common.elasticsearch.service.ElasticsearchPluginMonitor;
import co.elastic.clients.elasticsearch.ElasticsearchClient;
import co.elastic.clients.elasticsearch.core.BulkRequest;
import co.elastic.clients.elasticsearch.indices.CreateIndexRequest;
import co.elastic.clients.elasticsearch.indices.ElasticsearchIndicesClient;
import co.elastic.clients.elasticsearch.indices.PutAliasRequest;
import co.elastic.clients.elasticsearch.indices.UpdateAliasesRequest;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.io.IOException;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@Tag("dev")
class DefaultElasticsearchOperationsTest {

    @Test
    void shouldCreateIndexWithSettingsAndMappings() throws IOException {
        ElasticsearchClient client = mock(ElasticsearchClient.class);
        ElasticsearchIndicesClient indices = indices(client);
        ElasticsearchPluginMonitor monitor = availableMonitor();
        DefaultElasticsearchOperations operations = operations(client, monitor);

        operations.createIndex(definition());

        ArgumentCaptor<CreateIndexRequest> requestCaptor = ArgumentCaptor.forClass(CreateIndexRequest.class);
        verify(indices).create(requestCaptor.capture());
        CreateIndexRequest request = requestCaptor.getValue();
        assertEquals("system-message-v1", request.index());
        assertEquals("1", request.settings().numberOfShards());
        assertTrue(request.mappings().properties().get("title").isText());
        assertTrue(operations.status().available());
        assertEquals(1, operations.status().successfulOperations());
    }

    @Test
    void shouldKeepConnectionAvailableWhenElasticsearchRejectsCreateIndex() throws IOException {
        ElasticsearchClient client = mock(ElasticsearchClient.class);
        ElasticsearchIndicesClient indices = indices(client);
        when(indices.create(any(CreateIndexRequest.class))).thenThrow(new IllegalStateException("mapping conflict"));
        ElasticsearchPluginMonitor monitor = availableMonitor();
        DefaultElasticsearchOperations operations = operations(client, monitor);

        assertThrows(ElasticsearchOperationException.class, () -> operations.createIndex(definition()));

        assertOperationFailure(operations.status(), "IllegalStateException");
    }

    @Test
    void shouldKeepConnectionAvailableWhenElasticsearchRejectsAliasBinding() throws IOException {
        ElasticsearchClient client = mock(ElasticsearchClient.class);
        ElasticsearchIndicesClient indices = indices(client);
        when(indices.putAlias(any(PutAliasRequest.class))).thenThrow(new IllegalStateException("alias conflict"));
        ElasticsearchPluginMonitor monitor = availableMonitor();
        DefaultElasticsearchOperations operations = operations(client, monitor);

        assertThrows(ElasticsearchOperationException.class, () -> operations.bindAlias("system-message", "system-message-v1"));

        assertOperationFailure(operations.status(), "IllegalStateException");
    }

    @Test
    void shouldBindAliasWithAliasFirst() throws IOException {
        ElasticsearchClient client = mock(ElasticsearchClient.class);
        ElasticsearchIndicesClient indices = indices(client);
        DefaultElasticsearchOperations operations = operations(client, availableMonitor());

        operations.bindAlias("system-message", "system-message-v1");

        ArgumentCaptor<PutAliasRequest> requestCaptor = ArgumentCaptor.forClass(PutAliasRequest.class);
        verify(indices).putAlias(requestCaptor.capture());
        assertEquals("system-message", requestCaptor.getValue().name());
        assertEquals(List.of("system-message-v1"), requestCaptor.getValue().index());
    }

    @Test
    void shouldSwitchAliasWithOneRequestContainingRemoveAndAdd() throws IOException {
        ElasticsearchClient client = mock(ElasticsearchClient.class);
        ElasticsearchIndicesClient indices = indices(client);
        DefaultElasticsearchOperations operations = operations(client, availableMonitor());

        operations.switchAlias("system-message", "system-message-v1", "system-message-v2");

        ArgumentCaptor<UpdateAliasesRequest> requestCaptor = ArgumentCaptor.forClass(UpdateAliasesRequest.class);
        verify(indices, times(1)).updateAliases(requestCaptor.capture());
        UpdateAliasesRequest request = requestCaptor.getValue();
        assertEquals(2, request.actions().size());
        assertTrue(request.actions().get(0).isRemove());
        assertEquals("system-message-v1", request.actions().get(0).remove().index());
        assertEquals("system-message", request.actions().get(0).remove().alias());
        assertTrue(request.actions().get(1).isAdd());
        assertEquals("system-message-v2", request.actions().get(1).add().index());
        assertEquals("system-message", request.actions().get(1).add().alias());
    }

    @Test
    void shouldRejectInvalidLocalOperationsWithoutClientInteraction() {
        ElasticsearchClient client = mock(ElasticsearchClient.class);
        ElasticsearchIndicesClient indices = indices(client);
        ElasticsearchPluginMonitor monitor = availableMonitor();
        DefaultElasticsearchOperations operations = operations(client, monitor);

        assertAll(
            () -> assertThrows(NullPointerException.class, () -> operations.createIndex(null)),
            () -> assertThrows(IllegalArgumentException.class, () -> operations.bindAlias(" ", "system-message-v1")),
            () -> assertThrows(IllegalArgumentException.class,
                () -> operations.switchAlias("system-message", "system-message-v1", "system-message-v1"))
        );

        verifyNoInteractions(indices);
        ElasticsearchPluginStatus status = operations.status();
        assertTrue(status.available());
        assertEquals(0, status.connectionFailures());
        assertEquals(0, status.operationFailures());
    }

    @Test
    void shouldMarkConnectionUnavailableWhenAliasSwitchTransportFails() throws IOException {
        ElasticsearchClient client = mock(ElasticsearchClient.class);
        ElasticsearchIndicesClient indices = indices(client);
        when(indices.updateAliases(any(UpdateAliasesRequest.class))).thenThrow(new IOException("connection reset"));
        ElasticsearchPluginMonitor monitor = availableMonitor();
        DefaultElasticsearchOperations operations = operations(client, monitor);

        assertThrows(ElasticsearchUnavailableException.class,
            () -> operations.switchAlias("system-message", "system-message-v1", "system-message-v2"));

        ElasticsearchPluginStatus status = operations.status();
        assertFalse(status.available());
        assertEquals(1, status.connectionFailures());
        assertEquals(1, status.operationFailures());
        assertEquals("IOException", status.lastFailure());
    }

    @Test
    void shouldKeepConnectionAvailableWhenElasticsearchRejectsBulkOperation() throws IOException {
        ElasticsearchClient client = mock(ElasticsearchClient.class);
        ElasticsearchPluginMonitor monitor = availableMonitor();
        when(client.bulk(any(BulkRequest.class))).thenThrow(new IllegalStateException("mapping conflict"));
        DefaultElasticsearchOperations operations = operations(client, monitor);

        assertThrows(ElasticsearchOperationException.class, () -> operations.bulkIndex(documents()));

        assertOperationFailure(operations.status(), "IllegalStateException");
    }

    @Test
    void shouldMarkConnectionUnavailableWhenBulkTransportFails() throws IOException {
        ElasticsearchClient client = mock(ElasticsearchClient.class);
        ElasticsearchPluginMonitor monitor = availableMonitor();
        when(client.bulk(any(BulkRequest.class))).thenThrow(new IOException("connection reset"));
        DefaultElasticsearchOperations operations = operations(client, monitor);

        assertThrows(ElasticsearchUnavailableException.class, () -> operations.bulkIndex(documents()));

        ElasticsearchPluginStatus status = operations.status();
        assertFalse(status.available());
        assertEquals(1, status.connectionFailures());
        assertEquals(1, status.operationFailures());
        assertEquals("IOException", status.lastFailure());
    }

    private static ElasticsearchIndicesClient indices(ElasticsearchClient client) {
        ElasticsearchIndicesClient indices = mock(ElasticsearchIndicesClient.class);
        when(client.indices()).thenReturn(indices);
        return indices;
    }

    private static ElasticsearchPluginMonitor availableMonitor() {
        ElasticsearchPluginMonitor monitor = new ElasticsearchPluginMonitor();
        monitor.available();
        return monitor;
    }

    private static void assertOperationFailure(ElasticsearchPluginStatus status, String failureType) {
        assertTrue(status.available());
        assertEquals(0, status.connectionFailures());
        assertEquals(1, status.operationFailures());
        assertEquals(failureType, status.lastFailure());
    }

    private static DefaultElasticsearchOperations operations(ElasticsearchClient client,
                                                             ElasticsearchPluginMonitor monitor) {
        return new DefaultElasticsearchOperations(new ElasticsearchClientResources(() -> { }, client), monitor);
    }

    private static ElasticsearchIndexDefinition definition() {
        return new ElasticsearchIndexDefinition("system-message-v1", Map.of("number_of_shards", "1"),
            Map.of("properties", Map.of("title", Map.of("type", "text"))));
    }

    private static List<ElasticsearchDocument> documents() {
        return List.of(new ElasticsearchDocument("system-message", "1", Map.of("title", "message")));
    }
}
