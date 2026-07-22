package cc.infoq.common.elasticsearch;

import java.util.List;

public interface ElasticsearchOperations extends ElasticsearchStatusProvider, AutoCloseable {

    void createIndex(ElasticsearchIndexDefinition definition);

    void deleteIndex(String index);

    void bindAlias(String alias, String index);

    void switchAlias(String alias, String sourceIndex, String targetIndex);

    void bulkIndex(List<ElasticsearchDocument> documents);

    @Override
    default void close() {
    }
}
