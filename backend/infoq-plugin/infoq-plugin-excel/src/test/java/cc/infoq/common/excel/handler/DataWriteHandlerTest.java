package cc.infoq.common.excel.handler;

import cc.infoq.common.excel.annotation.ExcelNotation;
import cc.infoq.common.excel.annotation.ExcelRequired;
import cn.idev.excel.annotation.ExcelProperty;
import cn.idev.excel.metadata.data.WriteCellData;
import cn.idev.excel.write.handler.context.CellWriteHandlerContext;
import cn.idev.excel.write.metadata.holder.WriteSheetHolder;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.when;

@Tag("dev")
class DataWriteHandlerTest {

    @Test
    @DisplayName("afterCellDispose: should apply required style and notation comment on head cell")
    void afterCellDisposeShouldApplyStyleAndNotationOnHeadCell() {
        DataWriteHandler handler = new DataWriteHandler(ExportRow.class);
        Workbook workbook = new XSSFWorkbook();
        Sheet sheet = workbook.createSheet("main");
        Row row = sheet.createRow(0);
        Cell cell = row.createCell(0);
        cell.setCellValue("姓名");

        WriteSheetHolder writeSheetHolder = Mockito.mock(WriteSheetHolder.class);
        when(writeSheetHolder.getSheet()).thenReturn(sheet);

        CellWriteHandlerContext context = Mockito.mock(CellWriteHandlerContext.class);
        when(context.getHead()).thenReturn(true);
        WriteCellData<?> cellData = new WriteCellData<>("姓名");
        doReturn(cellData).when(context).getFirstCellData();
        when(context.getCell()).thenReturn(cell);
        when(context.getWriteSheetHolder()).thenReturn(writeSheetHolder);

        handler.afterCellDispose(context);

        assertEquals((short) 49, cellData.getOrCreateStyle().getDataFormatData().getIndex());
        assertNotNull(cell.getCellComment());
        assertEquals("必填字段", cell.getCellComment().getString().getString());
    }

    @Test
    @DisplayName("afterCellDispose: should no-op when current cell is not header")
    void afterCellDisposeShouldNoopWhenNotHeadCell() {
        DataWriteHandler handler = new DataWriteHandler(ExportRow.class);
        Workbook workbook = new XSSFWorkbook();
        Sheet sheet = workbook.createSheet("main");
        Row row = sheet.createRow(1);
        Cell cell = row.createCell(0);
        cell.setCellValue("姓名");

        CellWriteHandlerContext context = Mockito.mock(CellWriteHandlerContext.class);
        when(context.getHead()).thenReturn(false);
        when(context.getFirstCellData()).thenReturn(new WriteCellData<>("姓名"));
        when(context.getCell()).thenReturn(cell);

        handler.afterCellDispose(context);

        assertNull(cell.getCellComment());
    }

    @Test
    @DisplayName("afterCellDispose: should no-op when class has no required/notation fields")
    void afterCellDisposeShouldNoopWhenNoAnnotations() {
        DataWriteHandler handler = new DataWriteHandler(PlainRow.class);
        Workbook workbook = new XSSFWorkbook();
        Sheet sheet = workbook.createSheet("main");
        Row row = sheet.createRow(0);
        Cell cell = row.createCell(0);
        cell.setCellValue("普通列");

        CellWriteHandlerContext context = Mockito.mock(CellWriteHandlerContext.class);
        when(context.getHead()).thenReturn(true);
        when(context.getFirstCellData()).thenReturn(new WriteCellData<>("普通列"));
        when(context.getCell()).thenReturn(cell);

        handler.afterCellDispose(context);

        assertNull(cell.getCellComment());
    }

    private static class ExportRow {

        @ExcelProperty("姓名")
        @ExcelRequired
        @ExcelNotation("必填字段")
        private String name;
    }

    private static class PlainRow {

        @ExcelProperty("普通列")
        private String value;
    }
}
