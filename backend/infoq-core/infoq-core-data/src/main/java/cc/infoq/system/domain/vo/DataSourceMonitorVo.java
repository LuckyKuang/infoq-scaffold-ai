package cc.infoq.system.domain.vo;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

/**
 * 数据源监控视图对象
 *
 * @author Pontus
 */
@Data
public class DataSourceMonitorVo implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    private Summary summary;

    private List<Pool> items = new ArrayList<>();

    @Data
    public static class Summary implements Serializable {

        @Serial
        private static final long serialVersionUID = 1L;

        private Integer dataSourceCount;

        private Integer activeConnections;

        private Integer idleConnections;

        private Integer totalConnections;

        private Integer maximumPoolSize;

        private Integer threadsAwaitingConnection;
    }

    @Data
    public static class Pool implements Serializable {

        @Serial
        private static final long serialVersionUID = 1L;

        private String name;

        private String dbType;

        private Boolean metricsReady;

        private Boolean running;

        private Integer activeConnections;

        private Integer idleConnections;

        private Integer totalConnections;

        private Integer threadsAwaitingConnection;

        private Integer maximumPoolSize;

        private Double usagePercent;

        private String state;
    }
}
