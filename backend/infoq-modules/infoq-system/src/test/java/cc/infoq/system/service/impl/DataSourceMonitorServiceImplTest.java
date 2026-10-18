package cc.infoq.system.service.impl;

import cc.infoq.common.exception.ServiceException;
import cc.infoq.system.domain.vo.DataSourceMonitorVo;
import com.baomidou.dynamic.datasource.DynamicRoutingDataSource;
import com.baomidou.dynamic.datasource.ds.ItemDataSource;
import com.p6spy.engine.spy.P6DataSource;
import com.zaxxer.hikari.HikariConfigMXBean;
import com.zaxxer.hikari.HikariDataSource;
import com.zaxxer.hikari.HikariPoolMXBean;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import javax.sql.DataSource;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@Tag("dev")
class DataSourceMonitorServiceImplTest {

    @Test
    @DisplayName("getMonitorInfo: should unwrap item datasource and aggregate hikari metrics")
    void getMonitorInfoShouldUnwrapItemDataSourceAndAggregateHikariMetrics() {
        DynamicRoutingDataSource routingDataSource = mock(DynamicRoutingDataSource.class);
        HikariDataSource hikariDataSource = mock(HikariDataSource.class);
        HikariPoolMXBean poolMXBean = mock(HikariPoolMXBean.class);
        HikariConfigMXBean configMXBean = mock(HikariConfigMXBean.class);
        ItemDataSource itemDataSource = new ItemDataSource(
            "master",
            hikariDataSource,
            new P6DataSource(hikariDataSource),
            true,
            false,
            null
        );
        Map<String, DataSource> dataSources = new LinkedHashMap<>();
        dataSources.put("master", itemDataSource);

        when(routingDataSource.getDataSources()).thenReturn(dataSources);
        when(hikariDataSource.getJdbcUrl()).thenReturn("jdbc:mysql://localhost:3306/infoq?user=root&password=123456&useSSL=true");
        when(hikariDataSource.getHikariPoolMXBean()).thenReturn(poolMXBean);
        when(hikariDataSource.getHikariConfigMXBean()).thenReturn(configMXBean);
        when(hikariDataSource.isRunning()).thenReturn(true);
        when(configMXBean.getMaximumPoolSize()).thenReturn(20);
        when(poolMXBean.getActiveConnections()).thenReturn(5);
        when(poolMXBean.getIdleConnections()).thenReturn(7);
        when(poolMXBean.getTotalConnections()).thenReturn(12);
        when(poolMXBean.getThreadsAwaitingConnection()).thenReturn(1);

        DataSourceMonitorServiceImpl service = new DataSourceMonitorServiceImpl(routingDataSource);
        DataSourceMonitorVo result = service.getMonitorInfo();

        assertEquals(1, result.getSummary().getDataSourceCount());
        assertEquals(5, result.getSummary().getActiveConnections());
        assertEquals(7, result.getSummary().getIdleConnections());
        assertEquals(12, result.getSummary().getTotalConnections());
        assertEquals(20, result.getSummary().getMaximumPoolSize());
        assertEquals(1, result.getSummary().getThreadsAwaitingConnection());

        DataSourceMonitorVo.Pool pool = result.getItems().get(0);
        assertEquals("master", pool.getName());
        assertEquals("MySQL", pool.getDbType());
        assertEquals("BUSY", pool.getState());
        assertEquals(25.0D, pool.getUsagePercent());
    }

    @Test
    @DisplayName("getMonitorInfo: should mark uninitialized pool when mxbean not ready")
    void getMonitorInfoShouldMarkUninitializedPoolWhenMxBeanNotReady() {
        DynamicRoutingDataSource routingDataSource = mock(DynamicRoutingDataSource.class);
        HikariDataSource hikariDataSource = mock(HikariDataSource.class);
        Map<String, DataSource> dataSources = new LinkedHashMap<>();
        dataSources.put("master", hikariDataSource);

        when(routingDataSource.getDataSources()).thenReturn(dataSources);
        when(hikariDataSource.getJdbcUrl()).thenReturn("jdbc:mysql://localhost:3306/infoq");
        when(hikariDataSource.getHikariPoolMXBean()).thenReturn(null);
        when(hikariDataSource.getHikariConfigMXBean()).thenReturn(null);
        when(hikariDataSource.isRunning()).thenReturn(false);
        when(hikariDataSource.getMaximumPoolSize()).thenReturn(20);

        DataSourceMonitorServiceImpl service = new DataSourceMonitorServiceImpl(routingDataSource);
        DataSourceMonitorVo result = service.getMonitorInfo();

        assertEquals("UNINITIALIZED", result.getItems().get(0).getState());
        assertEquals("MySQL", result.getItems().get(0).getDbType());
        assertEquals(0, result.getSummary().getActiveConnections());
    }

    @Test
    @DisplayName("getMonitorInfo: should fail explicitly for unsupported datasource")
    void getMonitorInfoShouldFailExplicitlyForUnsupportedDataSource() {
        DynamicRoutingDataSource routingDataSource = mock(DynamicRoutingDataSource.class);
        DataSource unsupportedDataSource = mock(DataSource.class);
        Map<String, DataSource> dataSources = new LinkedHashMap<>();
        dataSources.put("legacy", unsupportedDataSource);

        when(routingDataSource.getDataSources()).thenReturn(dataSources);
        try {
            when(unsupportedDataSource.isWrapperFor(HikariDataSource.class)).thenReturn(false);
        } catch (Exception e) {
            throw new AssertionError(e);
        }

        DataSourceMonitorServiceImpl service = new DataSourceMonitorServiceImpl(routingDataSource);

        ServiceException exception = assertThrows(ServiceException.class, service::getMonitorInfo);
        assertTrue(exception.getMessage().contains("legacy"));
        assertTrue(exception.getMessage().contains("Hikari"));
    }
}
