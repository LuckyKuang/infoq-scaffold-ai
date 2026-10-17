package cc.infoq.common.excel.convert;

import cn.idev.excel.enums.CellDataTypeEnum;
import cn.idev.excel.metadata.data.ReadCellData;
import cn.idev.excel.metadata.data.WriteCellData;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@Tag("dev")
class ExcelBigNumberConvertTest {

    private final ExcelBigNumberConvert converter = new ExcelBigNumberConvert();

    @Test
    @DisplayName("convertToJavaData: should parse read cell value to long")
    void convertToJavaDataShouldParseLong() {
        ReadCellData<?> cellData = mock(ReadCellData.class);
        when(cellData.getData()).thenReturn("12345");
        Long value = converter.convertToJavaData(cellData, null, null);
        assertEquals(12345L, value);
    }

    @Test
    @DisplayName("convertToExcelData: should output string for >15 digits and number otherwise")
    void convertToExcelDataShouldHandleLargeAndNormalNumbers() {
        WriteCellData<Object> large = converter.convertToExcelData(1234567890123456L, null, null);
        assertEquals("1234567890123456", large.getStringValue());

        WriteCellData<Object> normal = converter.convertToExcelData(12345L, null, null);
        assertEquals(CellDataTypeEnum.NUMBER, normal.getType());
        assertEquals(new BigDecimal("12345"), normal.getNumberValue());
    }
}
