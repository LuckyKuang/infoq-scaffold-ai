package cc.infoq.common.elasticsearch;

public class ElasticsearchOperationException extends IllegalStateException {

    public ElasticsearchOperationException(String message) {
        super(message);
    }

    public ElasticsearchOperationException(String message, Throwable cause) {
        super(message, cause);
    }
}
