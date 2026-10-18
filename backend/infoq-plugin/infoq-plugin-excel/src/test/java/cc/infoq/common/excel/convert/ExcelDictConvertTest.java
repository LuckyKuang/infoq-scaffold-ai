package cc.infoq.common.excel.convert;

import cc.infoq.common.excel.annotation.ExcelDictFormat;
import cc.infoq.common.service.DictService;
import cc.infoq.common.utils.SpringUtils;
import cn.idev.excel.metadata.data.ReadCellData;
import cn.idev.excel.metadata.data.WriteCellData;
import cn.idev.excel.metadata.property.ExcelContentProperty;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.context.support.GenericApplicationContext;

import java.lang.reflect.Field;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@Tag("dev")
class ExcelDictConvertTest {

    private final ExcelDictConvert converter = new ExcelDictConvert();

    @Test
    @DisplayName("support keys: should expose object java type and null excel type")
    void supportKeysShouldReturnExpectedTypes() {
        assertEquals(Object.class, converter.supportJavaTypeKey());
        assertNull(converter.supportExcelTypeKey());
    }

    @Test
    @DisplayName("convertToJavaData: should use readConverterExp when dictType is blank")
    void convertToJavaDataShouldUseReadConverterExpWhenDictTypeBlank() throws Exception {
        ExcelContentProperty contentProperty = property("genderByExp");
        ReadCellData<String> cellData = new ReadCellData<>("女");

        Object value = converter.convertToJavaData(cellData, contentProperty, null);

        assertEquals(1, value);
    }

    @Test
    @DisplayName("convertToJavaData: should use DictService when dictType is present")
    void convertToJavaDataShouldUseDictServiceWhenDictTypePresent() throws Exception {
        ExcelContentProperty contentProperty = property("genderByDict");
        ReadCellData<String> cellData = new ReadCellData<>("女");
        DictService dictService = mock(DictService.class);
        when(dictService.getDictValue("sys_user_sex", "女", ",")).thenReturn("1");
        GenericApplicationContext context = new GenericApplicationContext();
        context.registerBean(DictService.class, () -> dictService);
        context.refresh();
        new SpringUtils().setApplicationContext(context);

        try {
            Object value = converter.convertToJavaData(cellData, contentProperty, null);
            assertEquals("1", value);
        } finally {
            context.close();
        }
    }

    @Test
    @DisplayName("convertToExcelData: should use readConverterExp when dictType is blank")
    void convertToExcelDataShouldUseReadConverterExpWhenDictTypeBlank() throws Exception {
        ExcelContentProperty contentProperty = property("genderByExp");

        WriteCellData<String> cellData = converter.convertToExcelData(0, contentProperty, null);

        assertEquals("男", cellData.getStringValue());
    }

    @Test
    @DisplayName("convertToExcelData: should use DictService when dictType is present")
    void convertToExcelDataShouldUseDictServiceWhenDictTypePresent() throws Exception {
        ExcelContentProperty contentProperty = property("genderByDict");
        DictService dictService = mock(DictService.class);
        when(dictService.getDictLabel("sys_user_sex", "1", ",")).thenReturn("女");
        GenericApplicationContext context = new GenericApplicationContext();
        context.registerBean(DictService.class, () -> dictService);
        context.refresh();
        new SpringUtils().setApplicationContext(context);

        try {
            WriteCellData<String> cellData = converter.convertToExcelData("1", contentProperty, null);
            assertEquals("女", cellData.getStringValue());
        } finally {
            context.close();
        }
    }

    @Test
    @DisplayName("convertToExcelData: should return empty string for null source value")
    void convertToExcelDataShouldReturnEmptyForNull() throws Exception {
        ExcelContentProperty contentProperty = property("genderByDict");

        WriteCellData<String> cellData = converter.convertToExcelData(null, contentProperty, null);

        assertEquals("", cellData.getStringValue());
    }

    private static ExcelContentProperty property(String fieldName) throws NoSuchFieldException {
        Field field = DictDemo.class.getDeclaredField(fieldName);
        ExcelContentProperty contentProperty = new ExcelContentProperty();
        contentProperty.setField(field);
        return contentProperty;
    }

    private static class DictDemo {

        @ExcelDictFormat(readConverterExp = "0=男,1=女")
        private Integer genderByExp;

        @ExcelDictFormat(dictType = "sys_user_sex")
        private String genderByDict;
    }
}
