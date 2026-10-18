package cc.infoq.common.mybatis.enums;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Tag("dev")
class DataBaseTypeTest {

    @Test
    void findShouldFallbackToMySqlForBlankAndUnknownName() {
        assertEquals(DataBaseType.MY_SQL, DataBaseType.find(null));
        assertEquals(DataBaseType.MY_SQL, DataBaseType.find(""));
        assertEquals(DataBaseType.MY_SQL, DataBaseType.find("Unknown"));
    }

    @Test
    void findShouldMatchKnownDatabaseNames() {
        assertEquals(DataBaseType.MY_SQL, DataBaseType.find("MySQL"));
        assertEquals(DataBaseType.ORACLE, DataBaseType.find("Oracle"));
        assertEquals(DataBaseType.POSTGRE_SQL, DataBaseType.find("PostgreSQL"));
        assertEquals(DataBaseType.SQL_SERVER, DataBaseType.find("Microsoft SQL Server"));
    }

    @Test
    void predicateMethodsShouldMatchCurrentEnumConstant() {
        assertTrue(DataBaseType.MY_SQL.isMySql());
        assertFalse(DataBaseType.MY_SQL.isOracle());
        assertFalse(DataBaseType.MY_SQL.isPostgreSql());
        assertFalse(DataBaseType.MY_SQL.isSqlServer());

        assertTrue(DataBaseType.ORACLE.isOracle());
        assertTrue(DataBaseType.POSTGRE_SQL.isPostgreSql());
        assertTrue(DataBaseType.SQL_SERVER.isSqlServer());
    }
}
