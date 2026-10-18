package cc.infoq.common.mybatis.helper;

import cc.infoq.common.utils.SpringUtils;
import com.baomidou.dynamic.datasource.DynamicRoutingDataSource;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.context.support.GenericApplicationContext;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.SQLException;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@Tag("dev")
class DataBaseHelperTest {

    @Test
    void helperShouldCoverDialectAndExceptionBranches() throws SQLException {
        DynamicRoutingDataSource dynamicRoutingDataSource = mock(DynamicRoutingDataSource.class);
        DataSource dataSource = mock(DataSource.class);
        Connection connection = mock(Connection.class);
        DatabaseMetaData metaData = mock(DatabaseMetaData.class);

        when(dynamicRoutingDataSource.determineDataSource()).thenReturn(dataSource);
        when(dataSource.getConnection())
            .thenReturn(connection)
            .thenReturn(connection)
            .thenReturn(connection)
            .thenReturn(connection)
            .thenThrow(new SQLException("boom"));
        when(connection.getMetaData()).thenReturn(metaData);
        when(metaData.getDatabaseProductName())
            .thenReturn("Oracle")
            .thenReturn("PostgreSQL")
            .thenReturn("Microsoft SQL Server")
            .thenReturn("Unknown");

        Map<String, DataSource> dataSources = new LinkedHashMap<>();
        dataSources.put("master", dataSource);
        dataSources.put("slave", dataSource);
        when(dynamicRoutingDataSource.getDataSources()).thenReturn(dataSources);

        GenericApplicationContext context = new GenericApplicationContext();
        context.registerBean(DynamicRoutingDataSource.class, () -> dynamicRoutingDataSource);
        context.refresh();
        new SpringUtils().setApplicationContext(context);

        try {
            assertEquals("instr(','||dept_ids||',' , ',100,') <> 0", DataBaseHelper.findInSet(100, "dept_ids"));
            assertEquals("(select strpos(','||dept_ids||',' , ',100,')) <> 0", DataBaseHelper.findInSet(100, "dept_ids"));
            assertEquals("charindex(',100,' , ','+dept_ids+',') <> 0", DataBaseHelper.findInSet(100, "dept_ids"));
            assertEquals("find_in_set('100' , dept_ids) <> 0", DataBaseHelper.findInSet(100, "dept_ids"));
            assertEquals(2, DataBaseHelper.getDataSourceNameList().size());
            assertThrows(RuntimeException.class, DataBaseHelper::getDataBaseType);
        } finally {
            context.close();
        }
    }
}
