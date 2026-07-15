package cc.infoq.common.elasticsearch.service;

import cc.infoq.common.elasticsearch.ElasticsearchPluginStatus;

import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;

public class ElasticsearchPluginMonitor {

    private final AtomicBoolean available = new AtomicBoolean();
    private final AtomicReference<String> lastFailure = new AtomicReference<>();
    private final AtomicLong connectionFailures = new AtomicLong();
    private final AtomicLong successfulOperations = new AtomicLong();
    private final AtomicLong operationFailures = new AtomicLong();
    private final AtomicLong bulkItemFailures = new AtomicLong();
    private final AtomicLong lastOperationDurationMs = new AtomicLong();
    private final AtomicLong totalOperationDurationMs = new AtomicLong();

    public void available() {
        available.set(true);
        lastFailure.set(null);
    }

    public void connectionFailed(Throwable failure) {
        available.set(false);
        connectionFailures.incrementAndGet();
        lastFailure.set(failure.getClass().getSimpleName());
    }

    public void operationSucceeded(long durationNanos) {
        successfulOperations.incrementAndGet();
        recordOperationDuration(durationNanos);
    }

    public void operationFailed(Throwable failure, long durationNanos) {
        operationFailures.incrementAndGet();
        recordOperationDuration(durationNanos);
        lastFailure.set(failure.getClass().getSimpleName());
    }

    public void operationConnectionFailed(Throwable failure, long durationNanos) {
        connectionFailed(failure);
        operationFailed(failure, durationNanos);
    }

    public void bulkItemsFailed(long count) {
        if (count > 0) {
            bulkItemFailures.addAndGet(count);
        }
    }

    public ElasticsearchPluginStatus status() {
        return new ElasticsearchPluginStatus(true, available.get(), lastFailure.get(), connectionFailures.get(),
            successfulOperations.get(), operationFailures.get(), bulkItemFailures.get(), lastOperationDurationMs.get(),
            totalOperationDurationMs.get());
    }

    private void recordOperationDuration(long durationNanos) {
        long durationMs = TimeUnit.NANOSECONDS.toMillis(Math.max(0, durationNanos));
        lastOperationDurationMs.set(durationMs);
        totalOperationDurationMs.addAndGet(durationMs);
    }
}
