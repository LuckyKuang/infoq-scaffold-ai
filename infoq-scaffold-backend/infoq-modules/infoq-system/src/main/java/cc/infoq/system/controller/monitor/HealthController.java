package cc.infoq.system.controller.monitor;

import cc.infoq.common.elasticsearch.ElasticsearchStatusProvider;
import cc.infoq.common.mqtt.MqttStatusProvider;
import lombok.AllArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 健康检查
 * @author Pontus
 * @since 2026/5/12 16:46
 */
@AllArgsConstructor
@RestController
@RequestMapping("/monitor/health")
public class HealthController {

     private static final String UP = "UP";

     private static final String DOWN = "DOWN";

     private final JdbcTemplate jdbcTemplate;

     private final RedisConnectionFactory redisConnectionFactory;

     private final ObjectProvider<MqttStatusProvider> mqttStatusProvider;

     private final ObjectProvider<ElasticsearchStatusProvider> elasticsearchStatusProvider;

     /**
      * 获取健康检查信息
      */
     @GetMapping
     public String checkHealth() {
         return "ok";
     }

     /**
      * 进程存活检查，只证明应用容器可响应 HTTP。
      */
     @GetMapping("/liveness")
     public String liveness() {
         return "ok";
     }

     /**
      * 流量接入检查，关键依赖不可用时返回非 2xx。
      */
     @GetMapping("/readiness")
     public ResponseEntity<HealthReport> readiness() {
         Map<String, DependencyHealth> dependencies = new LinkedHashMap<>();
         dependencies.put("database", checkDatabase());
         dependencies.put("redis", checkRedis());

         boolean ready = dependencies.values().stream()
             .allMatch(DependencyHealth::isUp);
         HealthReport report = new HealthReport(ready ? UP : DOWN, dependencies);
         return ResponseEntity.status(ready ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE)
             .body(report);
     }

     /**
      * Optional middleware status. It never changes the core database/Redis readiness result.
      */
     @GetMapping("/optional")
     public OptionalHealthReport optional() {
         Map<String, Object> dependencies = new LinkedHashMap<>();
         MqttStatusProvider mqtt = mqttStatusProvider.getIfAvailable();
         ElasticsearchStatusProvider elasticsearch = elasticsearchStatusProvider.getIfAvailable();
         if (mqtt != null) {
             dependencies.put("mqtt", mqtt.status());
         }
         if (elasticsearch != null) {
             dependencies.put("elasticsearch", elasticsearch.status());
         }
         return new OptionalHealthReport(dependencies);
     }

     private DependencyHealth checkDatabase() {
         try {
             Integer result = jdbcTemplate.queryForObject("SELECT 1", Integer.class);
             if (Integer.valueOf(1).equals(result)) {
                 return DependencyHealth.up();
             }
             return DependencyHealth.down("unexpected-result");
         } catch (Exception ex) {
             return DependencyHealth.down(ex.getClass().getSimpleName());
         }
     }

     private DependencyHealth checkRedis() {
         RedisConnection connection = null;
         try {
             connection = redisConnectionFactory.getConnection();
             String pong = connection.ping();
             if ("PONG".equalsIgnoreCase(pong)) {
                 return DependencyHealth.up();
             }
             return DependencyHealth.down("unexpected-result");
         } catch (Exception ex) {
             return DependencyHealth.down(ex.getClass().getSimpleName());
         } finally {
             if (connection != null) {
                 try {
                     connection.close();
                 } catch (Exception ignored) {
                     // Close failure should not hide the readiness result.
                 }
             }
         }
     }

     public record HealthReport(String status, Map<String, DependencyHealth> dependencies) {
     }

     public record OptionalHealthReport(Map<String, Object> dependencies) {
     }

     public record DependencyHealth(String status, String reason) {

         static DependencyHealth up() {
             return new DependencyHealth(UP, null);
         }

         static DependencyHealth down(String reason) {
             return new DependencyHealth(DOWN, reason);
         }

         boolean isUp() {
             return UP.equals(status);
         }
     }
}
