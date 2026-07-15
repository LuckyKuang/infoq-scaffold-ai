package cc.infoq.common.elasticsearch.config;

import co.elastic.clients.json.jackson.JacksonJsonpMapper;
import co.elastic.clients.transport.rest_client.RestClientTransport;
import org.apache.http.HttpHost;
import org.apache.http.auth.AuthScope;
import org.apache.http.auth.UsernamePasswordCredentials;
import org.apache.http.client.CredentialsProvider;
import org.apache.http.impl.client.BasicCredentialsProvider;
import org.elasticsearch.client.RestClient;
import org.elasticsearch.client.RestClientBuilder;

import java.util.List;

final class ElasticsearchClientFactory {

    private ElasticsearchClientFactory() {
    }

    static ElasticsearchClientResources create(ElasticsearchProperties properties) {
        List<HttpHost> hosts = properties.getUris().stream()
            .filter(uri -> uri != null && !uri.isBlank())
            .map(HttpHost::create)
            .toList();
        RestClientBuilder builder = RestClient.builder(hosts.toArray(HttpHost[]::new));
        builder.setRequestConfigCallback(config -> config
            .setConnectTimeout(Math.toIntExact(properties.getConnectTimeout().toMillis()))
            .setSocketTimeout(Math.toIntExact(properties.getRequestTimeout().toMillis())));
        if (hasText(properties.getUsername())) {
            builder.setHttpClientConfigCallback(httpClient -> httpClient
                .setDefaultCredentialsProvider(credentials(properties)));
        }
        RestClientTransport transport = new RestClientTransport(builder.build(), new JacksonJsonpMapper());
        return new ElasticsearchClientResources(transport);
    }

    private static CredentialsProvider credentials(ElasticsearchProperties properties) {
        BasicCredentialsProvider provider = new BasicCredentialsProvider();
        provider.setCredentials(AuthScope.ANY,
            new UsernamePasswordCredentials(properties.getUsername(), properties.getPassword()));
        return provider;
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
