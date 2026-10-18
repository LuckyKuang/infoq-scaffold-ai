package cc.infoq.common.excel.core;

import cc.infoq.common.excel.annotation.CellMerge;
import cn.idev.excel.annotation.ExcelProperty;
import cn.idev.excel.write.metadata.holder.WriteSheetHolder;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.apache.poi.ss.util.CellRangeAddress;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@Tag("dev")
class CellMergeStrategyTest {

    @Test
    @DisplayName("constructors: should support range list and row list overloads")
    void constructorsShouldSupportAllOverloads() {
        CellMergeStrategy fromRange = new CellMergeStrategy(List.of(new CellRangeAddress(1, 2, 0, 0)));
        CellMergeStrategy fromList = new CellMergeStrategy(sampleRows(), true);
        CellMergeStrategy fromListWithRowIndex = new CellMergeStrategy(sampleRows(), true, 2);

        assertNotNull(fromRange);
        assertNotNull(fromList);
        assertNotNull(fromListWithRowIndex);
    }

    @Test
    @DisplayName("afterSheetCreate: should pre-register merged regions")
    void afterSheetCreateShouldAddMergedRegions() {
        CellMergeStrategy strategy = new CellMergeStrategy(List.of(new CellRangeAddress(1, 2, 0, 0)));
        XSSFWorkbook workbook = new XSSFWorkbook();
        org.apache.poi.ss.usermodel.Sheet sheet = workbook.createSheet("demo");

        WriteSheetHolder writeSheetHolder = mock(WriteSheetHolder.class);
        when(writeSheetHolder.getSheet()).thenReturn(sheet);

        strategy.afterSheetCreate(null, writeSheetHolder);
        assertEquals(1, sheet.getNumMergedRegions());
    }

    private static List<RowWithMerge> sampleRows() {
        return List.of(
            new RowWithMerge("研发部", "A"),
            new RowWithMerge("研发部", "A"),
            new RowWithMerge("测试部", "B")
        );
    }

    private static class RowWithMerge {

        @ExcelProperty("部门")
        @CellMerge(mergeBy = {"groupCode"})
        private final String deptName;

        @ExcelProperty("分组")
        private final String groupCode;

        private RowWithMerge(String deptName, String groupCode) {
            this.deptName = deptName;
            this.groupCode = groupCode;
        }

        public String getDeptName() {
            return deptName;
        }

        public String getGroupCode() {
            return groupCode;
        }
    }
}
