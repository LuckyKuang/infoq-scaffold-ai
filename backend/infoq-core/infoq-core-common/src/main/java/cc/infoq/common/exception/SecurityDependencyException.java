package cc.infoq.common.exception;

public final class SecurityDependencyException extends RuntimeException {
    private final String operation;
    private final String dependencyType;

    public SecurityDependencyException(String operation, Class<? extends RuntimeException> dependencyType) {
        // Redis exceptions can include command arguments containing session credentials.
        super("认证存储暂不可用，请稍后重试", null);
        this.operation = operation;
        this.dependencyType = dependencyType.getSimpleName();
    }

    public String operation() {
        return operation;
    }

    public String dependencyType() {
        return dependencyType;
    }
}
