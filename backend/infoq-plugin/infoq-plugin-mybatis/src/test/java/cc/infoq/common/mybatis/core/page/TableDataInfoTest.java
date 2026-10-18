package cc.infoq.common.mybatis.core.page;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

@Tag("dev")
class TableDataInfoTest {

    @Test
    @DisplayName("constructor: should set rows/total/success fields")
    void constructorShouldSetSuccessFields() {
        TableDataInfo<String> data = new TableDataInfo<>(List.of("a", "b"), 2L);

        assertEquals(2L, data.getTotal());
        assertEquals(List.of("a", "b"), data.getRows());
        assertEquals(200, data.getCode());
        assertEquals("查询成功", data.getMsg());
    }

    @Test
    @DisplayName("build(page): should map records and total")
    void buildByPageShouldMapValues() {
        Page<String> page = new Page<>(2, 10);
        page.setRecords(List.of("x", "y"));
        page.setTotal(22L);

        TableDataInfo<String> data = TableDataInfo.build(page);

        assertEquals(22L, data.getTotal());
        assertEquals(List.of("x", "y"), data.getRows());
        assertEquals(200, data.getCode());
        assertEquals("查询成功", data.getMsg());
    }

    @Test
    @DisplayName("build(list): should use list size as total")
    void buildByListShouldUseListSizeAsTotal() {
        TableDataInfo<String> data = TableDataInfo.build(List.of("a", "b", "c"));

        assertEquals(3L, data.getTotal());
        assertEquals(List.of("a", "b", "c"), data.getRows());
        assertEquals(200, data.getCode());
        assertEquals("查询成功", data.getMsg());
    }

    @Test
    @DisplayName("build(): should create empty success wrapper")
    void buildShouldCreateEmptySuccessWrapper() {
        TableDataInfo<String> data = TableDataInfo.build();

        assertEquals(0L, data.getTotal());
        assertNull(data.getRows());
        assertEquals(200, data.getCode());
        assertEquals("查询成功", data.getMsg());
    }

    @Test
    @DisplayName("build(list,page): should return empty wrapper when source list is empty")
    void buildByListAndPageShouldHandleEmptyList() {
        Page<String> page = new Page<>(1, 5);
        TableDataInfo<String> data = TableDataInfo.build(List.of(), page);

        assertEquals(0L, data.getTotal());
        assertEquals(List.of(), data.getRows());
        assertEquals(200, data.getCode());
        assertEquals("查询成功", data.getMsg());
    }

    @Test
    @DisplayName("build(list,page): should paginate in-memory list")
    void buildByListAndPageShouldPaginateInMemory() {
        Page<Integer> page = new Page<>(2, 2);
        TableDataInfo<Integer> data = TableDataInfo.build(List.of(10, 20, 30, 40, 50), page);

        assertEquals(5L, data.getTotal());
        assertEquals(List.of(30, 40), data.getRows());
        assertEquals(200, data.getCode());
        assertEquals("查询成功", data.getMsg());
    }
}
