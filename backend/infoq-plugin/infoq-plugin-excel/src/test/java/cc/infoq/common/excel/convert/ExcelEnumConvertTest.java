package cc.infoq.common.excel.convert;

import cc.infoq.common.excel.annotation.ExcelEnumFormat;
import cn.idev.excel.enums.CellDataTypeEnum;
import cn.idev.excel.metadata.data.ReadCellData;
import cn.idev.excel.metadata.data.WriteCellData;
import cn.idev.excel.metadata.property.ExcelContentProperty;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

@Tag("dev")
class ExcelEnumConvertTest {

    private final ExcelEnumConvert converter = new ExcelEnumConvert();

    @Test
    @DisplayName("support keys: should expose object java type and null excel type")
    void supportKeysShouldReturnExpectedTypes() {
        assertEquals(Object.class, converter.supportJavaTypeKey());
        assertNull(converter.supportExcelTypeKey());
    }

    @Test
    @DisplayName("convertToJavaData: should map display text to enum code")
    void convertToJavaDataShouldMapDisplayTextToCode() throws Exception {
        ExcelContentProperty contentProperty = property("gender");
        ReadCellData<String> cellData = new ReadCellData<>("女");

        Object value = converter.convertToJavaData(cellData, contentProperty, null);

        assertEquals(2, value);
    }

    @Test
    @DisplayName("convertToJavaData: should throw for unsupported cell type")
    void convertToJavaDataShouldThrowForUnsupportedCellType() throws Exception {
        ExcelContentProperty contentProperty = property("gender");
        ReadCellData<Object> cellData = new ReadCellData<>(CellDataTypeEnum.ERROR);

        assertThrows(IllegalArgumentException.class, () -> converter.convertToJavaData(cellData, contentProperty, null));
    }

    @Test
    @DisplayName("convertToExcelData: should map enum code to display text")
    void convertToExcelDataShouldMapCodeToDisplayText() throws Exception {
        ExcelContentProperty contentProperty = property("gender");

        WriteCellData<String> cellData = converter.convertToExcelData(1, contentProperty, null);

        assertEquals("男", cellData.getStringValue());
    }

    @Test
    @DisplayName("convertToExcelData: should return empty string for null value")
    void convertToExcelDataShouldReturnEmptyStringForNull() throws Exception {
        ExcelContentProperty contentProperty = property("gender");

        WriteCellData<String> cellData = converter.convertToExcelData(null, contentProperty, null);

        assertEquals("", cellData.getStringValue());
    }

    private static ExcelContentProperty property(String fieldName) throws NoSuchFieldException {
        Field field = EnumDemo.class.getDeclaredField(fieldName);
        ExcelContentProperty contentProperty = new ExcelContentProperty();
        contentProperty.setField(field);
        return contentProperty;
    }

    private static class EnumDemo {

        @ExcelEnumFormat(enumClass = GenderEnum.class)
        private Integer gender;
    }

    private enum GenderEnum {
        MALE(1, "男"),
        FEMALE(2, "女");

        private final Integer code;
        private final String text;

        GenderEnum(Integer code, String text) {
            this.code = code;
            this.text = text;
        }

        public Integer getCode() {
            return code;
        }

        public String getText() {
            return text;
        }
    }
}

