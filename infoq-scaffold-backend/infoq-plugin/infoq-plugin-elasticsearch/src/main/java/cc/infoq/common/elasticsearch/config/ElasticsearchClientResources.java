package cc.infoq.common.elasticsearch.config;

import cc.infoq.common.elasticsearch.ElasticsearchUnavailableException;
import co.elastic.clients.elasticsearch.ElasticsearchClient;
import co.elastic.clients.transport.rest_client.RestClientTransport;

final class ElasticsearchClientResources implements AutoCloseable {

    private final AutoCloseable closeable;
    private final ElasticsearchClient client;

    ElasticsearchClientResources(RestClientTransport transport) {
        this(transport, new ElasticsearchClient(transport));
    }

    ElasticsearchClientResources(AutoCloseable closeable, ElasticsearchClient client) {
        this.closeable = closeable;
        this.client = client;
    }

    ElasticsearchClient client() {
        return client;
    }

    @Override
    public void close() {
        try {
            closeable.close();
        } catch (Exception ex) {
            throw new ElasticsearchUnavailableException("Elasticsearch client close failed", ex);
        }
    }
}
