package cc.infoq.common.elasticsearch;

public class ElasticsearchUnavailableException extends IllegalStateException {

    public ElasticsearchUnavailableException(String message) {
        super(message);
    }

    public ElasticsearchUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
