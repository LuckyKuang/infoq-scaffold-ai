package cc.infoq.common.elasticsearch.config;

import cc.infoq.common.elasticsearch.ElasticsearchDocument;
import cc.infoq.common.elasticsearch.ElasticsearchIndexDefinition;
import cc.infoq.common.elasticsearch.ElasticsearchOperationException;
import cc.infoq.common.elasticsearch.ElasticsearchUnavailableException;
import cc.infoq.common.elasticsearch.service.ElasticsearchPluginMonitor;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.security.cert.CertificateException;
import java.security.cert.X509Certificate;
import java.time.Duration;
import java.util.Base64;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@Tag("docker-it")
class ElasticsearchDockerIntegrationTest {

    private static final ObjectMapper JSON = new ObjectMapper();
    private ElasticsearchClientResources resources;
    private DefaultElasticsearchOperations operations;
    private String v1;
    private String v2;

    @AfterEach
    void cleanRunScopedIndexes() {
        if (operations == null) {
            return;
        }
        deleteQuietly(v1);
        deleteQuietly(v2);
        operations.close();
    }

    @Test
    void shouldVerifyTlsRestrictedRoleMappingBulkAndAtomicAliasSwitch() throws Exception {
        Assumptions.assumeFalse(Boolean.parseBoolean(System.getenv("INFOQ_IT_ES_EXPECT_UNAVAILABLE")),
            "Positive Elasticsearch assertions are skipped while the node is intentionally stopped");
        String runId = required("INFOQ_IT_RUN_ID");
        String prefix = required("INFOQ_IT_ES_INDEX_PREFIX");
        v1 = prefix + "v1";
        v2 = prefix + "v2";
        String alias = prefix + "current";
        operations = connect(required("INFOQ_IT_ES_USERNAME"), required("INFOQ_IT_ES_PASSWORD"));
        HttpClient rest = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
        assertClusterCapacity(rest);

        operations.createIndex(definition(v1));
        operations.bulkIndex(List.of(document(v1, "alpha", 1, "first"), document(v1, "beta", 1, "second"),
            document(v1, "alpha", 2, "updated")));
        refresh(rest, v1);
        operations.bindAlias(alias, v1);

        JsonNode mapping = get(rest, "/" + v1 + "/_mapping");
        JsonNode fields = mapping.path(v1).path("mappings").path("properties");
        assertEquals("keyword", fields.path("sourceId").path("type").asText());
        assertEquals("long", fields.path("revision").path("type").asText());
        assertEquals("text", fields.path("body").path("type").asText());
        assertEquals("date", fields.path("updatedAt").path("type").asText());
        assertEquals(2, get(rest, "/" + v1 + "/_count").path("count").asInt());
        assertEquals(2, get(rest, "/" + alias + "/_count").path("count").asInt());

        assertThrows(ElasticsearchOperationException.class, () -> operations.createIndex(definition(v1)));
        assertTrue(operations.status().available());

        operations.createIndex(definition(v2));
        operations.bulkIndex(List.of(document(v2, "alpha", 2, "updated"), document(v2, "gamma", 1, "replacement")));
        refresh(rest, v2);
        assertEquals(2, get(rest, "/" + v2 + "/_count").path("count").asInt());
        JsonNode v2Hits = get(rest, "/" + v2 + "/_search?size=10&sort=sourceId:asc").path("hits").path("hits");
        assertEquals(2, v2Hits.size());
        assertEquals("alpha", v2Hits.get(0).path("_source").path("sourceId").asText());
        assertEquals(2, v2Hits.get(0).path("_source").path("revision").asInt());
        assertEquals("gamma", v2Hits.get(1).path("_source").path("sourceId").asText());
        assertEquals(1, v2Hits.get(1).path("_source").path("revision").asInt());
        operations.switchAlias(alias, v1, v2);
        JsonNode aliases = get(rest, "/_alias/" + alias);
        assertTrue(aliases.has(v2));
        assertFalse(aliases.has(v1));
        assertEquals(2, get(rest, "/" + alias + "/_count").path("count").asInt());

        assertEquals(403, request(rest, "PUT", "/not_allowed_" + runId, "{}").statusCode());
        assertWrongCredentialsAreUnavailable();
        assertUntrustedCaFailsTlsHandshake();
    }

    @Test
    void shouldReportUnavailableWhenNodeIsStopped() {
        Assumptions.assumeTrue(Boolean.parseBoolean(System.getenv("INFOQ_IT_ES_EXPECT_UNAVAILABLE")),
            "This assertion only runs after the verification runner stops Elasticsearch");
        ElasticsearchProperties properties = new ElasticsearchProperties();
        properties.setEnabled(true);
        properties.setRequired(true);
        properties.setTlsEnabled(true);
        properties.setUris(List.of(required("INFOQ_IT_ES_URI")));
        properties.setUsername(required("INFOQ_IT_ES_USERNAME"));
        properties.setPassword(required("INFOQ_IT_ES_PASSWORD"));
        ElasticsearchPropertiesValidator.validate(properties);
        ElasticsearchClientResources unavailableResources = ElasticsearchClientFactory.create(properties);
        DefaultElasticsearchOperations unavailable = new DefaultElasticsearchOperations(unavailableResources,
            new ElasticsearchPluginMonitor());
        try {
            assertThrows(ElasticsearchUnavailableException.class, unavailable::verifyConnection);
        } finally {
            unavailable.close();
        }
    }

    private DefaultElasticsearchOperations connect(String username, String password) {
        ElasticsearchProperties properties = new ElasticsearchProperties();
        properties.setEnabled(true);
        properties.setRequired(true);
        properties.setTlsEnabled(true);
        properties.setUris(List.of(required("INFOQ_IT_ES_URI")));
        properties.setUsername(username);
        properties.setPassword(password);
        ElasticsearchPropertiesValidator.validate(properties);
        resources = ElasticsearchClientFactory.create(properties);
        DefaultElasticsearchOperations candidate = new DefaultElasticsearchOperations(resources, new ElasticsearchPluginMonitor());
        candidate.verifyConnection();
        return candidate;
    }

    private void assertWrongCredentialsAreUnavailable() {
        ElasticsearchProperties properties = new ElasticsearchProperties();
        properties.setEnabled(true);
        properties.setRequired(true);
        properties.setTlsEnabled(true);
        properties.setUris(List.of(required("INFOQ_IT_ES_URI")));
        properties.setUsername("wrong-user");
        properties.setPassword("wrong-password");
        ElasticsearchClientResources badResources = ElasticsearchClientFactory.create(properties);
        DefaultElasticsearchOperations bad = new DefaultElasticsearchOperations(badResources, new ElasticsearchPluginMonitor());
        try {
            assertThrows(ElasticsearchUnavailableException.class, bad::verifyConnection);
        } finally {
            bad.close();
        }
    }

    private void assertUntrustedCaFailsTlsHandshake() throws Exception {
        SSLContext context = SSLContext.getInstance("TLS");
        context.init(null, new TrustManager[]{new X509TrustManager() {
            @Override public void checkClientTrusted(X509Certificate[] c, String a) throws CertificateException { throw new CertificateException("untrusted"); }
            @Override public void checkServerTrusted(X509Certificate[] c, String a) throws CertificateException { throw new CertificateException("untrusted"); }
            @Override public X509Certificate[] getAcceptedIssuers() { return new X509Certificate[0]; }
        }}, new SecureRandom());
        HttpClient untrusted = HttpClient.newBuilder().sslContext(context).connectTimeout(Duration.ofSeconds(10)).build();
        assertThrows(Exception.class, () -> untrusted.send(HttpRequest.newBuilder(URI.create(required("INFOQ_IT_ES_URI")))
            .GET().timeout(Duration.ofSeconds(10)).build(), HttpResponse.BodyHandlers.ofString()));
    }

    private void assertClusterCapacity(HttpClient rest) throws Exception {
        String healthStatus = get(rest, "/_cluster/health").path("status").asText();
        assertTrue("yellow".equals(healthStatus) || "green".equals(healthStatus),
            "Single-node Elasticsearch health must be yellow or green");
        JsonNode nodes = get(rest, "/_nodes/stats/jvm,fs").path("nodes");
        assertFalse(nodes.isEmpty(), "Elasticsearch node stats must contain the running node");
        JsonNode node = nodes.elements().next();
        assertTrue(node.path("jvm").path("mem").path("heap_max_in_bytes").asLong() >= 1024L * 1024 * 1024,
            "Elasticsearch must expose the configured 1 GiB heap");
        assertTrue(node.path("fs").path("total").path("available_in_bytes").asLong() >= 5L * 1024 * 1024 * 1024,
            "Elasticsearch filesystem must retain at least 5 GiB available for this validation");
    }

    private void refresh(HttpClient client, String index) throws Exception {
        assertEquals(200, request(client, "POST", "/" + index + "/_refresh", null).statusCode(),
            "Run-scoped role must refresh its own index before read assertions");
    }

    private JsonNode get(HttpClient client, String path) throws Exception {
        HttpResponse<String> response = request(client, "GET", path, null);
        assertEquals(200, response.statusCode(), "Run-scoped REST access must be authorized");
        return JSON.readTree(response.body());
    }

    private HttpResponse<String> request(HttpClient client, String method, String path, String body) throws Exception {
        HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(required("INFOQ_IT_ES_URI") + path))
            .timeout(Duration.ofSeconds(15))
            .header("Authorization", basic(required("INFOQ_IT_ES_USERNAME"), required("INFOQ_IT_ES_PASSWORD")));
        if (body == null) {
            builder.method(method, HttpRequest.BodyPublishers.noBody());
        } else {
            builder.header("Content-Type", "application/json").method(method, HttpRequest.BodyPublishers.ofString(body));
        }
        return client.send(builder.build(), HttpResponse.BodyHandlers.ofString());
    }

    private static ElasticsearchIndexDefinition definition(String index) {
        return new ElasticsearchIndexDefinition(index, Map.of("number_of_shards", 1, "number_of_replicas", 0),
            Map.of("properties", Map.of("sourceId", Map.of("type", "keyword"), "revision", Map.of("type", "long"),
                "body", Map.of("type", "text"), "updatedAt", Map.of("type", "date"))));
    }

    private static ElasticsearchDocument document(String index, String sourceId, int revision, String body) {
        return new ElasticsearchDocument(index, sourceId, Map.of("sourceId", sourceId, "revision", revision,
            "body", body, "updatedAt", "2026-07-15T00:00:00Z"));
    }

    private void deleteQuietly(String index) {
        if (index == null) return;
        try {
            operations.deleteIndex(index);
        } catch (RuntimeException ignored) {
        }
    }

    private static String basic(String username, String password) {
        return "Basic " + Base64.getEncoder().encodeToString((username + ":" + password).getBytes(StandardCharsets.UTF_8));
    }

    private static String required(String name) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) throw new IllegalStateException("Missing Docker integration environment variable: " + name);
        return value;
    }
}
