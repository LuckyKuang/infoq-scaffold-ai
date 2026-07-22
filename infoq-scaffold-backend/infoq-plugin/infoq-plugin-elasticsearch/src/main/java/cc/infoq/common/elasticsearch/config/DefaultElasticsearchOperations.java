package cc.infoq.common.elasticsearch.config;

import cc.infoq.common.elasticsearch.*;
import cc.infoq.common.elasticsearch.service.ElasticsearchPluginMonitor;
import co.elastic.clients.elasticsearch._types.mapping.TypeMapping;
import co.elastic.clients.elasticsearch.core.BulkRequest;
import co.elastic.clients.elasticsearch.core.BulkResponse;
import co.elastic.clients.elasticsearch.indices.CreateIndexRequest;
import co.elastic.clients.elasticsearch.indices.IndexSettings;
import co.elastic.clients.elasticsearch.indices.PutAliasRequest;
import co.elastic.clients.elasticsearch.indices.UpdateAliasesRequest;
import co.elastic.clients.json.JsonpUtils;
import co.elastic.clients.json.jackson.JacksonJsonpMapper;

import java.io.IOException;
import java.io.StringReader;
import java.util.List;
import java.util.Map;
import java.util.Objects;

class DefaultElasticsearchOperations implements ElasticsearchOperations {

    private static final JacksonJsonpMapper JSON_MAPPER = new JacksonJsonpMapper();

    private final ElasticsearchClientResources resources;
    private final ElasticsearchPluginMonitor monitor;

    DefaultElasticsearchOperations(ElasticsearchClientResources resources,
                                   ElasticsearchPluginMonitor monitor) {
        this.resources = resources;
        this.monitor = monitor;
    }

    void verifyConnection() {
        try {
            if (!resources.client().ping().value()) {
                ElasticsearchUnavailableException failure =
                    new ElasticsearchUnavailableException("Elasticsearch ping returned false");
                monitor.connectionFailed(failure);
                throw failure;
            }
            monitor.available();
        } catch (ElasticsearchUnavailableException ex) {
            throw ex;
        } catch (Exception ex) {
            monitor.connectionFailed(ex);
            throw new ElasticsearchUnavailableException("Elasticsearch connection failed", ex);
        }
    }

    @Override
    public void createIndex(ElasticsearchIndexDefinition definition) {
        Objects.requireNonNull(definition, "definition must not be null");
        CreateIndexRequest request = new CreateIndexRequest.Builder()
            .index(definition.index())
            .settings(indexSettings(definition.settings()))
            .mappings(typeMapping(definition.mappings()))
            .build();
        execute(() -> resources.client().indices().create(request));
    }

    @Override
    public void deleteIndex(String index) {
        requireName(index, "index");
        execute(() -> resources.client().indices().delete(builder -> builder.index(index)));
    }

    @Override
    public void bindAlias(String alias, String index) {
        requireName(alias, "alias");
        requireName(index, "index");
        PutAliasRequest request = new PutAliasRequest.Builder().index(index).name(alias).build();
        execute(() -> resources.client().indices().putAlias(request));
    }

    @Override
    public void switchAlias(String alias, String sourceIndex, String targetIndex) {
        requireName(alias, "alias");
        requireName(sourceIndex, "sourceIndex");
        requireName(targetIndex, "targetIndex");
        if (sourceIndex.equals(targetIndex)) {
            throw new IllegalArgumentException("sourceIndex and targetIndex must differ");
        }
        UpdateAliasesRequest request = new UpdateAliasesRequest.Builder()
            .actions(action -> action.remove(remove -> remove.index(sourceIndex).alias(alias)))
            .actions(action -> action.add(add -> add.index(targetIndex).alias(alias)))
            .build();
        execute(() -> resources.client().indices().updateAliases(request));
    }

    @Override
    public void bulkIndex(List<ElasticsearchDocument> documents) {
        if (documents == null || documents.isEmpty()) {
            throw new IllegalArgumentException("documents must not be empty");
        }
        documents.forEach(document -> Objects.requireNonNull(document, "documents must not contain null entries"));
        execute(() -> {
            BulkRequest.Builder builder = new BulkRequest.Builder();
            for (ElasticsearchDocument document : documents) {
                builder.operations(operation -> operation.index(index -> index
                    .index(document.index())
                    .id(document.id())
                    .document(document.source())));
            }
            BulkResponse response = resources.client().bulk(builder.build());
            if (response.errors()) {
                monitor.bulkItemsFailed(response.items().stream().filter(item -> item.error() != null).count());
                throw new ElasticsearchOperationException("Elasticsearch bulk operation contains item failures");
            }
        });
    }

    @Override
    public ElasticsearchPluginStatus status() {
        return monitor.status();
    }

    @Override
    public void close() {
        resources.close();
    }

    private void execute(ElasticsearchAction action) {
        ensureAvailable();
        long startedAt = System.nanoTime();
        try {
            action.execute();
            monitor.operationSucceeded(System.nanoTime() - startedAt);
        } catch (IOException ex) {
            monitor.operationConnectionFailed(ex, System.nanoTime() - startedAt);
            throw new ElasticsearchUnavailableException("Elasticsearch operation connection failed", ex);
        } catch (ElasticsearchOperationException ex) {
            monitor.operationFailed(ex, System.nanoTime() - startedAt);
            throw ex;
        } catch (RuntimeException ex) {
            monitor.operationFailed(ex, System.nanoTime() - startedAt);
            throw new ElasticsearchOperationException("Elasticsearch operation failed", ex);
        }
    }

    private void ensureAvailable() {
        if (!monitor.status().available()) {
            verifyConnection();
        }
        if (!monitor.status().available()) {
            throw new ElasticsearchUnavailableException("Elasticsearch plugin is unavailable");
        }
    }

    private void requireName(String value, String name) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(name + " must not be blank");
        }
    }

    private static IndexSettings indexSettings(Map<String, Object> settings) {
        try (var parser = JSON_MAPPER.jsonProvider().createParser(new StringReader(json(settings)))) {
            return new IndexSettings.Builder().withJson(parser, JSON_MAPPER).build();
        }
    }

    private static TypeMapping typeMapping(Map<String, Object> mappings) {
        try (var parser = JSON_MAPPER.jsonProvider().createParser(new StringReader(json(mappings)))) {
            return new TypeMapping.Builder().withJson(parser, JSON_MAPPER).build();
        }
    }

    private static String json(Map<String, Object> value) {
        return JsonpUtils.toJsonString(value, JSON_MAPPER);
    }

    @FunctionalInterface
    private interface ElasticsearchAction {

        void execute() throws IOException;
    }
}
