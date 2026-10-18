package cc.infoq.common.elasticsearch.service;

import cc.infoq.common.elasticsearch.*;

import java.util.List;

public class UnavailableElasticsearchOperations implements ElasticsearchOperations {

    private final ElasticsearchPluginMonitor monitor;

    public UnavailableElasticsearchOperations(ElasticsearchPluginMonitor monitor) {
        this.monitor = monitor;
    }

    @Override
    public void createIndex(ElasticsearchIndexDefinition definition) {
        throw unavailable();
    }

    @Override
    public void deleteIndex(String index) {
        throw unavailable();
    }

    @Override
    public void bindAlias(String alias, String index) {
        throw unavailable();
    }

    @Override
    public void switchAlias(String alias, String sourceIndex, String targetIndex) {
        throw unavailable();
    }

    @Override
    public void bulkIndex(List<ElasticsearchDocument> documents) {
        throw unavailable();
    }

    @Override
    public ElasticsearchPluginStatus status() {
        return monitor.status();
    }

    private ElasticsearchUnavailableException unavailable() {
        return new ElasticsearchUnavailableException("Elasticsearch plugin is unavailable");
    }
}
