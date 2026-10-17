package cc.infoq.system.controller.monitor;

import cc.infoq.common.elasticsearch.ElasticsearchPluginStatus;
import cc.infoq.common.elasticsearch.ElasticsearchStatusProvider;
import cc.infoq.common.mqtt.MqttPluginStatus;
import cc.infoq.common.mqtt.MqttStatusProvider;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@Tag("dev")
class HealthControllerTest {

    @Test
    @DisplayName("health endpoints: should expose liveness and readiness routes")
    void healthEndpointsShouldExposeRoutes() throws NoSuchMethodException {
        RequestMapping requestMapping = HealthController.class.getAnnotation(RequestMapping.class);
        assertNotNull(requestMapping);
        assertArrayEquals(new String[]{"/monitor/health"}, requestMapping.value());

        GetMapping getMapping = HealthController.class.getMethod("checkHealth").getAnnotation(GetMapping.class);
        assertNotNull(getMapping);
        GetMapping livenessMapping = HealthController.class.getMethod("liveness").getAnnotation(GetMapping.class);
        assertNotNull(livenessMapping);
        assertArrayEquals(new String[]{"/liveness"}, livenessMapping.value());
        GetMapping readinessMapping = HealthController.class.getMethod("readiness").getAnnotation(GetMapping.class);
        assertNotNull(readinessMapping);
        assertArrayEquals(new String[]{"/readiness"}, readinessMapping.value());
        GetMapping optionalMapping = HealthController.class.getMethod("optional").getAnnotation(GetMapping.class);
        assertNotNull(optionalMapping);
        assertArrayEquals(new String[]{"/optional"}, optionalMapping.value());
    }

    @Test
    @DisplayName("liveness: should stay lightweight and return ok")
    void livenessShouldReturnOk() {
        HealthController controller = controller(mock(JdbcTemplate.class), mock(RedisConnectionFactory.class));

        assertEquals("ok", controller.checkHealth());
        assertEquals("ok", controller.liveness());
    }

    @Test
    @DisplayName("readiness: should return 200 when database and redis are available")
    void readinessShouldReturnOkWhenDependenciesAreAvailable() {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        RedisConnectionFactory redisConnectionFactory = mock(RedisConnectionFactory.class);
        RedisConnection redisConnection = mock(RedisConnection.class);
        when(jdbcTemplate.queryForObject("SELECT 1", Integer.class)).thenReturn(1);
        when(redisConnectionFactory.getConnection()).thenReturn(redisConnection);
        when(redisConnection.ping()).thenReturn("PONG");
        HealthController controller = controller(jdbcTemplate, redisConnectionFactory);

        ResponseEntity<HealthController.HealthReport> response = controller.readiness();

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals("UP", response.getBody().status());
        assertEquals("UP", response.getBody().dependencies().get("database").status());
        assertEquals("UP", response.getBody().dependencies().get("redis").status());
        verify(redisConnection).close();
    }

    @Test
    @DisplayName("readiness: should return 503 when database is unavailable")
    void readinessShouldReturnUnavailableWhenDatabaseFails() {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        RedisConnectionFactory redisConnectionFactory = mock(RedisConnectionFactory.class);
        RedisConnection redisConnection = mock(RedisConnection.class);
        when(jdbcTemplate.queryForObject("SELECT 1", Integer.class))
            .thenThrow(new DataAccessResourceFailureException("database unavailable"));
        when(redisConnectionFactory.getConnection()).thenReturn(redisConnection);
        when(redisConnection.ping()).thenReturn("PONG");
        HealthController controller = controller(jdbcTemplate, redisConnectionFactory);

        ResponseEntity<HealthController.HealthReport> response = controller.readiness();

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals("DOWN", response.getBody().status());
        assertEquals("DOWN", response.getBody().dependencies().get("database").status());
        assertEquals("DataAccessResourceFailureException", response.getBody().dependencies().get("database").reason());
        assertEquals("UP", response.getBody().dependencies().get("redis").status());
        verify(redisConnection).close();
    }

    @Test
    @DisplayName("readiness: should return 503 when redis is unavailable")
    void readinessShouldReturnUnavailableWhenRedisFails() {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        RedisConnectionFactory redisConnectionFactory = mock(RedisConnectionFactory.class);
        when(jdbcTemplate.queryForObject("SELECT 1", Integer.class)).thenReturn(1);
        when(redisConnectionFactory.getConnection()).thenThrow(new RedisConnectionFailureException("redis unavailable"));
        HealthController controller = controller(jdbcTemplate, redisConnectionFactory);

        ResponseEntity<HealthController.HealthReport> response = controller.readiness();

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals("DOWN", response.getBody().status());
        assertEquals("UP", response.getBody().dependencies().get("database").status());
        assertEquals("DOWN", response.getBody().dependencies().get("redis").status());
        assertEquals("RedisConnectionFailureException", response.getBody().dependencies().get("redis").reason());
    }

    @Test
    void shouldExposeOptionalMiddlewareWithoutChangingReadinessContract() {
        MqttStatusProvider mqttStatusProvider = () -> new MqttPluginStatus(false, Map.of());
        ElasticsearchStatusProvider elasticsearchStatusProvider =
            () -> new ElasticsearchPluginStatus(false, false, "disabled", 0, 0, 0, 0, 0, 0);
        ObjectProvider<MqttStatusProvider> mqttProvider = provider(mqttStatusProvider);
        ObjectProvider<ElasticsearchStatusProvider> elasticsearchProvider = provider(elasticsearchStatusProvider);
        HealthController controller = new HealthController(mock(JdbcTemplate.class), mock(RedisConnectionFactory.class),
            mqttProvider, elasticsearchProvider);

        HealthController.OptionalHealthReport report = controller.optional();

        assertEquals(mqttStatusProvider.status(), report.dependencies().get("mqtt"));
        assertEquals(elasticsearchStatusProvider.status(), report.dependencies().get("elasticsearch"));
    }

    private static HealthController controller(JdbcTemplate jdbcTemplate,
                                               RedisConnectionFactory redisConnectionFactory) {
        return new HealthController(jdbcTemplate, redisConnectionFactory, provider(null), provider(null));
    }

    @SuppressWarnings("unchecked")
    private static <T> ObjectProvider<T> provider(T value) {
        ObjectProvider<T> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(value);
        return provider;
    }
}
