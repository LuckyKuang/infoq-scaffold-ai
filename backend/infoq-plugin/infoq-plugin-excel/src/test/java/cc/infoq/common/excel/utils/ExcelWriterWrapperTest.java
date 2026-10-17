package cc.infoq.common.excel.utils;

import cn.idev.excel.ExcelWriter;
import cn.idev.excel.context.WriteContext;
import cn.idev.excel.write.metadata.WriteSheet;
import cn.idev.excel.write.metadata.WriteTable;
import cn.idev.excel.write.metadata.fill.FillConfig;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@Tag("dev")
class ExcelWriterWrapperTest {

    @Test
    @DisplayName("delegates: should forward write/fill/writeContext calls to excel writer")
    void delegateMethodsShouldForwardToExcelWriter() {
        ExcelWriter writer = mock(ExcelWriter.class);
        WriteContext writeContext = mock(WriteContext.class);
        when(writer.writeContext()).thenReturn(writeContext);

        ExcelWriterWrapper<Map<String, Object>> wrapper = ExcelWriterWrapper.of(writer);
        Collection<Map<String, Object>> data = List.of(Map.of("name", "alice"));
        WriteSheet writeSheet = mock(WriteSheet.class);
        WriteTable writeTable = mock(WriteTable.class);
        FillConfig fillConfig = FillConfig.builder().forceNewRow(Boolean.TRUE).build();
        Supplier<Collection<Map<String, Object>>> supplier = () -> data;
        Supplier<Object> fillSupplier = () -> Map.of("name", "alice");

        wrapper.write(data, writeSheet);
        wrapper.write(supplier, writeSheet);
        wrapper.write(data, writeSheet, writeTable);
        wrapper.write(supplier, writeSheet, writeTable);
        wrapper.fill(Map.of("name", "alice"), writeSheet);
        wrapper.fill(Map.of("name", "alice"), fillConfig, writeSheet);
        wrapper.fill(fillSupplier, writeSheet);
        wrapper.fill(fillSupplier, fillConfig, writeSheet);

        verify(writer, times(2)).write(data, writeSheet);
        verify(writer, times(2)).write(data, writeSheet, writeTable);
        verify(writer).fill(Map.of("name", "alice"), writeSheet);
        verify(writer).fill(Map.of("name", "alice"), fillConfig, writeSheet);
        verify(writer).fill(fillSupplier, writeSheet);
        verify(writer).fill(fillSupplier, fillConfig, writeSheet);
        assertSame(writeContext, wrapper.writeContext());
    }

    @Test
    @DisplayName("builders: should expose sheet/table factory methods")
    void buildersShouldReturnNonNullObjects() {
        assertNotNull(ExcelWriterWrapper.buildSheet(0, "users"));
        assertNotNull(ExcelWriterWrapper.buildSheet(0));
        assertNotNull(ExcelWriterWrapper.buildSheet("users"));
        assertNotNull(ExcelWriterWrapper.buildSheet());
        assertNotNull(ExcelWriterWrapper.sheetBuilder(0, "users"));
        assertNotNull(ExcelWriterWrapper.sheetBuilder(0));
        assertNotNull(ExcelWriterWrapper.sheetBuilder("users"));
        assertNotNull(ExcelWriterWrapper.sheetBuilder());

        assertNotNull(ExcelWriterWrapper.buildTable(1));
        assertNotNull(ExcelWriterWrapper.buildTable());
        assertNotNull(ExcelWriterWrapper.tableBuilder(1));
        assertNotNull(ExcelWriterWrapper.tableBuilder());
    }
}
