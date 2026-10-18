package cc.infoq.common.mybatis.core.page;

import cc.infoq.common.exception.ServiceException;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Tag("dev")
class PageQueryTest {

    @Test
    @DisplayName("build: should fallback defaults and sanitize non-positive pageNum")
    void buildShouldFallbackDefaultsAndFixPageNum() {
        PageQuery query = new PageQuery(null, 0);

        Page<String> page = query.build();

        assertEquals(PageQuery.DEFAULT_PAGE_NUM, page.getCurrent());
        assertEquals(PageQuery.DEFAULT_PAGE_SIZE, page.getSize());
        assertTrue(page.orders().isEmpty());
    }

    @Test
    @DisplayName("build: should convert camel orderBy and map ascending/descending")
    void buildShouldMapFrontendSortWords() {
        PageQuery query = new PageQuery(20, 2);
        query.setOrderByColumn("id,createTime");
        query.setIsAsc("ascending,descending");

        Page<String> page = query.build();

        assertEquals(2, page.orders().size());
        assertEquals("id", page.orders().get(0).getColumn());
        assertTrue(page.orders().get(0).isAsc());
        assertEquals("create_time", page.orders().get(1).getColumn());
        assertFalse(page.orders().get(1).isAsc());
    }

    @Test
    @DisplayName("build: should support single direction for multiple columns")
    void buildShouldSupportSingleDirectionForMultiColumns() {
        PageQuery query = new PageQuery(10, 1);
        query.setOrderByColumn("id,createTime");
        query.setIsAsc("desc");

        Page<String> page = query.build();

        assertEquals(2, page.orders().size());
        assertFalse(page.orders().get(0).isAsc());
        assertFalse(page.orders().get(1).isAsc());
    }

    @Test
    @DisplayName("build: should throw when asc array length mismatches column length")
    void buildShouldThrowOnMismatchedSortArgs() {
        PageQuery query = new PageQuery(10, 1);
        query.setOrderByColumn("id,createTime");
        query.setIsAsc("asc,desc,asc");

        assertThrows(ServiceException.class, query::build);
    }

    @Test
    @DisplayName("build: should throw when sort token is invalid")
    void buildShouldThrowOnInvalidSortToken() {
        PageQuery query = new PageQuery(10, 1);
        query.setOrderByColumn("id");
        query.setIsAsc("up");

        assertThrows(ServiceException.class, query::build);
    }

    @Test
    @DisplayName("getFirstNum: should compute page offset")
    void getFirstNumShouldComputeOffset() {
        PageQuery query = new PageQuery(25, 3);
        assertEquals(50, query.getFirstNum());
    }
}
