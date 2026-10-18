package cc.infoq.common.elasticsearch;

public record ElasticsearchPluginStatus(boolean enabled,
                                        boolean available,
                                        String lastFailure,
                                        long connectionFailures,
                                        long successfulOperations,
                                        long operationFailures,
                                        long bulkItemFailures,
                                        long lastOperationDurationMs,
                                        long totalOperationDurationMs) {
}
