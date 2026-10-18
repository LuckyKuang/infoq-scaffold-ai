package cc.infoq.common.excel.core;

import cc.infoq.common.excel.annotation.CellMerge;
import cn.idev.excel.annotation.ExcelProperty;
import org.apache.poi.ss.util.CellRangeAddress;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Tag("dev")
class CellMergeHandlerTest {

    @Test
    @DisplayName("handle: should return empty when rows are empty")
    void handleShouldReturnEmptyWhenRowsEmpty() {
        List<CellRangeAddress> ranges = CellMergeHandler.of(true).handle(List.of());
        assertTrue(ranges.isEmpty());
    }

    @Test
    @DisplayName("handle: should merge same value rows with title offset")
    void handleShouldMergeSameRowsWithTitleOffset() {
        List<RowWithMerge> rows = List.of(
            new RowWithMerge("研发部", "A", "tom"),
            new RowWithMerge("研发部", "A", "jerry"),
            new RowWithMerge("研发部", "B", "lucy"),
            new RowWithMerge("测试部", "B", "kate")
        );

        List<CellRangeAddress> ranges = CellMergeHandler.of(true).handle(rows);

        assertEquals(2, ranges.size());

        CellRangeAddress firstRange = ranges.get(0);
        assertEquals(1, firstRange.getFirstRow());
        assertEquals(2, firstRange.getLastRow());
        assertEquals(0, firstRange.getFirstColumn());

        CellRangeAddress secondRange = ranges.get(1);
        assertEquals(3, secondRange.getFirstRow());
        assertEquals(4, secondRange.getLastRow());
        assertEquals(0, secondRange.getFirstColumn());
    }

    @Test
    @DisplayName("handle: should merge full range when title is absent")
    void handleShouldMergeFullRangeWithoutTitle() {
        List<RowWithMerge> rows = List.of(
            new RowWithMerge("研发部", "A", "tom"),
            new RowWithMerge("研发部", "A", "jerry")
        );

        List<CellRangeAddress> ranges = CellMergeHandler.of(false).handle(rows);

        assertEquals(1, ranges.size());
        CellRangeAddress range = ranges.get(0);
        assertEquals(0, range.getFirstRow());
        assertEquals(1, range.getLastRow());
        assertEquals(0, range.getFirstColumn());
    }

    @Test
    @DisplayName("handle: should return empty when class has no merge annotations")
    void handleShouldReturnEmptyWhenNoMergeAnnotations() {
        List<NoMergeRow> rows = List.of(new NoMergeRow("A"), new NoMergeRow("A"));
        List<CellRangeAddress> ranges = CellMergeHandler.of().handle(rows);
        assertTrue(ranges.isEmpty());
    }

    @Test
    @DisplayName("handle: should respect custom title row index")
    void handleShouldRespectCustomRowIndex() {
        List<RowWithMerge> rows = List.of(
            new RowWithMerge("研发部", "A", "tom"),
            new RowWithMerge("研发部", "A", "jerry"),
            new RowWithMerge("研发部", "A", "lucy")
        );

        List<CellRangeAddress> ranges = CellMergeHandler.of(true, 2).handle(rows);

        assertEquals(1, ranges.size());
        CellRangeAddress range = ranges.get(0);
        assertEquals(2, range.getFirstRow());
        assertEquals(4, range.getLastRow());
    }

    private static class NoMergeRow {

        private final String deptName;

        private NoMergeRow(String deptName) {
            this.deptName = deptName;
        }

        public String getDeptName() {
            return deptName;
        }
    }

    private static class RowWithMerge {

        @ExcelProperty("部门")
        @CellMerge(mergeBy = {"groupCode"})
        private final String deptName;

        @ExcelProperty("分组")
        private final String groupCode;

        @ExcelProperty("姓名")
        private final String username;

        private RowWithMerge(String deptName, String groupCode, String username) {
            this.deptName = deptName;
            this.groupCode = groupCode;
            this.username = username;
        }

        public String getDeptName() {
            return deptName;
        }

        public String getGroupCode() {
            return groupCode;
        }

        public String getUsername() {
            return username;
        }
    }
}
