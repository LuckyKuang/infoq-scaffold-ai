package cc.infoq.common.security.browser;

public class BrowserSessionException extends RuntimeException {
    private final int status;

    public BrowserSessionException(int status, String category) {
        super(category);
        this.status = status;
    }

    public int status() {
        return status;
    }
}
