package cc.infoq.common.elasticsearch.service;

import cc.infoq.common.elasticsearch.ElasticsearchPluginStatus;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.junit.jupiter.api.Assertions.*;

@Tag("dev")
class ElasticsearchPluginMonitorTest {

    @Test
    void shouldRecordOperationFailureWithoutMarkingHealthyConnectionUnavailable() {
        ElasticsearchPluginMonitor monitor = new ElasticsearchPluginMonitor();
        monitor.available();
        monitor.operationSucceeded(Duration.ofMillis(8).toNanos());
        monitor.operationFailed(new IllegalStateException(), Duration.ofMillis(4).toNanos());
        monitor.bulkItemsFailed(3);

        ElasticsearchPluginStatus status = monitor.status();

        assertTrue(status.available());
        assertEquals(1, status.successfulOperations());
        assertEquals(1, status.operationFailures());
        assertEquals(3, status.bulkItemFailures());
        assertEquals(4, status.lastOperationDurationMs());
        assertEquals(12, status.totalOperationDurationMs());
        assertEquals("IllegalStateException", status.lastFailure());
    }

    @Test
    void shouldMarkConnectionUnavailableForOperationTransportFailure() {
        ElasticsearchPluginMonitor monitor = new ElasticsearchPluginMonitor();
        monitor.available();
        monitor.operationConnectionFailed(new IllegalStateException(), Duration.ofMillis(4).toNanos());

        ElasticsearchPluginStatus status = monitor.status();

        assertFalse(status.available());
        assertEquals(1, status.connectionFailures());
        assertEquals(1, status.operationFailures());
    }
}
