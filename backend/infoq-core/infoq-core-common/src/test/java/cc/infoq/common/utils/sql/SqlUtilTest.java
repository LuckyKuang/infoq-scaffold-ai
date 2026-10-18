package cc.infoq.common.utils.sql;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Tag("dev")
class SqlUtilTest {

    @Test
    @DisplayName("escapeOrderBySql/isValidOrderBySql: should accept legal order by expression")
    void escapeOrderBySqlShouldAcceptLegalExpression() {
        String orderBy = "create_time desc, user_name asc";

        assertEquals(orderBy, SqlUtil.escapeOrderBySql(orderBy));
        assertTrue(SqlUtil.isValidOrderBySql(orderBy));
    }

    @Test
    @DisplayName("escapeOrderBySql/isValidOrderBySql: should reject illegal characters")
    void escapeOrderBySqlShouldRejectIllegalCharacters() {
        String invalid = "create_time desc;";

        assertThrows(IllegalArgumentException.class, () -> SqlUtil.escapeOrderBySql(invalid));
        assertFalse(SqlUtil.isValidOrderBySql(invalid));
    }

    @Test
    @DisplayName("filterKeyword: should ignore empty input")
    void filterKeywordShouldIgnoreEmptyInput() {
        assertDoesNotThrow(() -> SqlUtil.filterKeyword(""));
        assertDoesNotThrow(() -> SqlUtil.filterKeyword(null));
    }

    @Test
    @DisplayName("filterKeyword: should throw when input contains sql keyword")
    void filterKeywordShouldThrowWhenContainsSqlKeyword() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
            () -> SqlUtil.filterKeyword("name UNION SELECT password from sys_user"));

        assertEquals("参数存在SQL注入风险", ex.getMessage());
    }
}
