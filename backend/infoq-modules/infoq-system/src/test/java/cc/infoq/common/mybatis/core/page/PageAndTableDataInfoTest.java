package cc.infoq.common.mybatis.core.page;

import cc.infoq.common.exception.ServiceException;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@Tag("dev")
class PageAndTableDataInfoTest {

    @Test
    @DisplayName("PageQuery.build: should use defaults when pageNum/pageSize missing")
    void pageQueryBuildShouldUseDefaults() {
        PageQuery query = new PageQuery(null, null);

        Page<String> page = query.build();

        assertEquals(PageQuery.DEFAULT_PAGE_NUM, page.getCurrent());
        assertEquals(PageQuery.DEFAULT_PAGE_SIZE, page.getSize());
    }

    @Test
    @DisplayName("PageQuery.build: should map ascending/descending to asc/desc")
    void pageQueryBuildShouldMapAscWords() {
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
    @DisplayName("PageQuery.build: should throw when order parameters are mismatched")
    void pageQueryBuildShouldThrowOnMismatchedOrderArgs() {
        PageQuery query = new PageQuery(20, 1);
        query.setOrderByColumn("id,createTime");
        query.setIsAsc("asc,desc,asc");

        assertThrows(ServiceException.class, query::build);
    }

    @Test
    @DisplayName("TableDataInfo.build(list): should set total and success code")
    void tableDataInfoBuildListShouldSetTotal() {
        TableDataInfo<String> data = TableDataInfo.build(List.of("a", "b"));

        assertEquals(2, data.getTotal());
        assertEquals(200, data.getCode());
        assertEquals("查询成功", data.getMsg());
    }

    @Test
    @DisplayName("TableDataInfo.build(list, page): should handle empty list")
    void tableDataInfoBuildFakePageShouldHandleEmptyList() {
        Page<String> page = new Page<>(1, 10);

        TableDataInfo<String> data = TableDataInfo.build(List.of(), page);

        assertEquals(200, data.getCode());
        assertEquals("查询成功", data.getMsg());
        assertEquals(List.of(), data.getRows());
        assertEquals(0, data.getTotal());
    }
}
