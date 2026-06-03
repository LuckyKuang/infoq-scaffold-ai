package cc.infoq.system.service.impl;

import cc.infoq.common.exception.ServiceException;
import cc.infoq.common.utils.StringUtils;
import cc.infoq.system.domain.vo.DataSourceMonitorVo;
import cc.infoq.system.service.DataSourceMonitorService;
import com.baomidou.dynamic.datasource.DynamicRoutingDataSource;
import com.baomidou.dynamic.datasource.ds.ItemDataSource;
import com.zaxxer.hikari.HikariConfigMXBean;
import com.zaxxer.hikari.HikariDataSource;
import com.zaxxer.hikari.HikariPoolMXBean;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import javax.sql.DataSource;
import java.sql.SQLException;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;

/**
 * Hikari 数据源监控服务
 *
 * <p>直接读取 {@link DynamicRoutingDataSource} 运行时信息，解析真实的 {@link HikariDataSource}，
 * 在不借用连接的前提下暴露连接池和配置指标。</p>
 *
 * @author Pontus
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DataSourceMonitorServiceImpl implements DataSourceMonitorService {

    private final DynamicRoutingDataSource dynamicRoutingDataSource;

    @Override
    public DataSourceMonitorVo getMonitorInfo() {
        try {
            Map<String, DataSource> dataSources = new TreeMap<>(dynamicRoutingDataSource.getDataSources());
            DataSourceMonitorVo monitor = new DataSourceMonitorVo();
            DataSourceMonitorVo.Summary summary = new DataSourceMonitorVo.Summary();
            summary.setDataSourceCount(dataSources.size());
            summary.setActiveConnections(0);
            summary.setIdleConnections(0);
            summary.setTotalConnections(0);
            summary.setMaximumPoolSize(0);
            summary.setThreadsAwaitingConnection(0);
            monitor.setSummary(summary);
            dataSources.forEach((name, dataSource) -> {
                DataSourceMonitorVo.Pool pool = inspectPool(name, dataSource);
                monitor.getItems().add(pool);
                accumulate(summary, pool);
            });
            return monitor;
        } catch (ServiceException e) {
            throw e;
        } catch (Exception e) {
            log.error("datasource monitor collection failed", e);
            throw new ServiceException("datasource monitor collection failed: {}", e.getMessage());
        }
    }

    private void accumulate(DataSourceMonitorVo.Summary summary, DataSourceMonitorVo.Pool pool) {
        summary.setActiveConnections(summary.getActiveConnections() + safeInt(pool.getActiveConnections()));
        summary.setIdleConnections(summary.getIdleConnections() + safeInt(pool.getIdleConnections()));
        summary.setTotalConnections(summary.getTotalConnections() + safeInt(pool.getTotalConnections()));
        summary.setMaximumPoolSize(summary.getMaximumPoolSize() + safeInt(pool.getMaximumPoolSize()));
        summary.setThreadsAwaitingConnection(summary.getThreadsAwaitingConnection() + safeInt(pool.getThreadsAwaitingConnection()));
    }

    private DataSourceMonitorVo.Pool inspectPool(String name, DataSource dataSource) {
        try {
            DataSourceSource source = resolveSource(dataSource);
            HikariDataSource hikariDataSource = unwrapHikari(source.candidateDataSource(), name);
            HikariPoolMXBean poolMXBean = hikariDataSource.getHikariPoolMXBean();

            DataSourceMonitorVo.Pool pool = new DataSourceMonitorVo.Pool();
            pool.setName(name);
            pool.setDbType(resolveDbType(hikariDataSource));
            pool.setMetricsReady(poolMXBean != null);
            pool.setRunning(hikariDataSource.isRunning());
            pool.setActiveConnections(poolMXBean != null ? poolMXBean.getActiveConnections() : null);
            pool.setIdleConnections(poolMXBean != null ? poolMXBean.getIdleConnections() : null);
            pool.setTotalConnections(poolMXBean != null ? poolMXBean.getTotalConnections() : null);
            pool.setThreadsAwaitingConnection(poolMXBean != null ? poolMXBean.getThreadsAwaitingConnection() : null);
            pool.setMaximumPoolSize(resolveMaximumPoolSize(hikariDataSource));
            pool.setUsagePercent(resolveUsagePercent(pool.getActiveConnections(), pool.getMaximumPoolSize()));
            pool.setState(resolveState(pool));
            return pool;
        } catch (ServiceException e) {
            log.error("datasource monitor collection failed datasource={}", name, e);
            throw e;
        } catch (Exception e) {
            log.error("datasource monitor collection failed datasource={}", name, e);
            throw new ServiceException("datasource[{}] monitor collection failed: {}", name, e.getMessage());
        }
    }

    private DataSourceSource resolveSource(DataSource dataSource) {
        if (dataSource instanceof ItemDataSource itemDataSource) {
            DataSource candidate = itemDataSource.getRealDataSource() != null ? itemDataSource.getRealDataSource() : itemDataSource.getDataSource();
            return new DataSourceSource(candidate);
        }
        return new DataSourceSource(dataSource);
    }

    private HikariDataSource unwrapHikari(DataSource dataSource, String name) {
        if (dataSource == null) {
            throw new ServiceException("datasource[{}] is null", name);
        }
        if (dataSource instanceof HikariDataSource hikariDataSource) {
            return hikariDataSource;
        }
        try {
            if (dataSource.isWrapperFor(HikariDataSource.class)) {
                return dataSource.unwrap(HikariDataSource.class);
            }
        } catch (SQLException e) {
            throw new ServiceException("datasource[{}] unwrap hikari failed: {}", name, e.getMessage());
        }
        throw new ServiceException("datasource[{}] is not a HikariDataSource", name);
    }

    private Double resolveUsagePercent(Integer activeConnections, Integer maximumPoolSize) {
        if (activeConnections == null || maximumPoolSize == null || maximumPoolSize <= 0) {
            return null;
        }
        return scale(activeConnections * 100D / maximumPoolSize, 2);
    }

    private Integer resolveMaximumPoolSize(HikariDataSource hikariDataSource) {
        HikariConfigMXBean configMXBean = hikariDataSource.getHikariConfigMXBean();
        return configMXBean != null ? configMXBean.getMaximumPoolSize() : hikariDataSource.getMaximumPoolSize();
    }

    private String resolveDbType(HikariDataSource hikariDataSource) {
        String jdbcUrl = hikariDataSource.getJdbcUrl();
        if (StringUtils.isNotBlank(jdbcUrl) && jdbcUrl.startsWith("jdbc:")) {
            String candidate = jdbcUrl.substring("jdbc:".length());
            int index = candidate.indexOf(':');
            String dbType = index > 0 ? candidate.substring(0, index) : candidate;
            if (StringUtils.isNotBlank(dbType)) {
                return formatDbType(dbType);
            }
        }
        return formatDbType(hikariDataSource.getDriverClassName());
    }

    private String formatDbType(String value) {
        if (StringUtils.isBlank(value)) {
            return "Unknown";
        }
        String normalized = value.toLowerCase(Locale.ROOT);
        if (normalized.contains("mysql")) {
            return "MySQL";
        }
        if (normalized.contains("mariadb")) {
            return "MariaDB";
        }
        if (normalized.contains("postgresql") || normalized.contains("postgres")) {
            return "PostgreSQL";
        }
        if (normalized.contains("oracle")) {
            return "Oracle";
        }
        if (normalized.contains("sqlserver") || normalized.contains("microsoft")) {
            return "SQL Server";
        }
        if (normalized.contains("h2")) {
            return "H2";
        }
        if (normalized.contains("sqlite")) {
            return "SQLite";
        }
        return Character.toUpperCase(value.charAt(0)) + value.substring(1);
    }

    private String resolveState(DataSourceMonitorVo.Pool pool) {
        if (!Boolean.TRUE.equals(pool.getMetricsReady())) {
            return "UNINITIALIZED";
        }
        int active = safeInt(pool.getActiveConnections());
        int idle = safeInt(pool.getIdleConnections());
        int awaiting = safeInt(pool.getThreadsAwaitingConnection());
        int maxPoolSize = safeInt(pool.getMaximumPoolSize());
        double usage = pool.getUsagePercent() == null ? 0D : pool.getUsagePercent();

        if (maxPoolSize > 0 && active >= maxPoolSize) {
            return "SATURATED";
        }
        if (awaiting > 0 && idle == 0) {
            return "SATURATED";
        }
        if (awaiting > 0 || usage >= 80D) {
            return "BUSY";
        }
        return "RUNNING";
    }

    private int safeInt(Integer value) {
        return value == null ? 0 : value;
    }

    private double scale(double value, int scale) {
        return java.math.BigDecimal.valueOf(value)
            .setScale(scale, java.math.RoundingMode.HALF_UP)
            .doubleValue();
    }

    private record DataSourceSource(DataSource candidateDataSource) {}
}
