package cc.infoq.common.excel.core;

import cc.infoq.common.excel.annotation.ExcelDictFormat;
import cc.infoq.common.excel.annotation.ExcelDynamicOptions;
import cc.infoq.common.excel.annotation.ExcelEnumFormat;
import cc.infoq.common.exception.ServiceException;
import cc.infoq.common.service.DictService;
import cc.infoq.common.utils.SpringUtils;
import cn.idev.excel.enums.CacheLocationEnum;
import cn.idev.excel.metadata.GlobalConfiguration;
import cn.idev.excel.annotation.ExcelProperty;
import cn.idev.excel.write.metadata.holder.WriteSheetHolder;
import cn.idev.excel.write.metadata.holder.WriteWorkbookHolder;
import org.apache.poi.hssf.usermodel.HSSFWorkbook;
import org.apache.poi.ss.usermodel.DataValidationConstraint;
import org.apache.poi.ss.usermodel.DataValidationHelper;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.util.CellRangeAddressList;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.context.support.GenericApplicationContext;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.IntStream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

@Tag("dev")
class ExcelDownHandlerTest {

    private static GenericApplicationContext context;
    private static DictService dictService;

    @BeforeAll
    static void initSpringContext() {
        dictService = Mockito.mock(DictService.class);
        context = new GenericApplicationContext();
        context.registerBean(DictService.class, () -> dictService);
        context.registerBean(DemoOptionsProvider.class, DemoOptionsProvider::new);
        context.refresh();
        new SpringUtils().setApplicationContext(context);
    }

    @Test
    @DisplayName("afterSheetCreate: should generate hidden options sheets and validations")
    void afterSheetCreateShouldGenerateHiddenOptionsSheetsAndValidations() {
        Map<String, String> dictValues = new LinkedHashMap<>();
        IntStream.range(0, 21).forEach(i -> dictValues.put(String.valueOf(i), "标签" + i));
        when(dictService.getAllDictByDictType("gender")).thenReturn(dictValues);

        DropDownOptions linked = new DropDownOptions();
        linked.setIndex(3);
        linked.setNextIndex(4);
        linked.setOptions(new ArrayList<>(List.of("华东", "华北")));
        linked.setNextOptions(Map.of(
            "华东", new ArrayList<>(List.of("上海", "杭州")),
            "华北", new ArrayList<>(List.of("北京"))
        ));

        DropDownOptions manySimple = new DropDownOptions(
            5,
            IntStream.range(0, 12).mapToObj(i -> "选项" + i).toList()
        );

        ExcelDownHandler handler = new ExcelDownHandler(List.of(linked, manySimple));
        Workbook workbook = new XSSFWorkbook();
        Sheet mainSheet = workbook.createSheet("main");

        WriteWorkbookHolder workbookHolder = mockWorkbookHolder(workbook, DemoRow.class);
        WriteSheetHolder sheetHolder = Mockito.mock(WriteSheetHolder.class);
        when(sheetHolder.getSheet()).thenReturn(mainSheet);

        handler.afterSheetCreate(workbookHolder, sheetHolder);

        assertTrue(mainSheet.getDataValidations().size() > 0);
        assertNotNull(workbook.getSheet("linkedOptions_0"));
        assertTrue(workbook.isSheetHidden(workbook.getSheetIndex("linkedOptions_0")));

        boolean hasHiddenOptionsSheet = IntStream.range(0, workbook.getNumberOfSheets())
            .mapToObj(workbook::getSheetName)
            .anyMatch(name -> name.startsWith("options_"));
        assertTrue(hasHiddenOptionsSheet);
    }

    @Test
    @DisplayName("afterSheetCreate: should throw when dict type does not exist")
    void afterSheetCreateShouldThrowWhenDictTypeMissing() {
        when(dictService.getAllDictByDictType("missing_dict")).thenReturn(null);

        ExcelDownHandler handler = new ExcelDownHandler(List.of());
        Workbook workbook = new XSSFWorkbook();
        Sheet mainSheet = workbook.createSheet("main");

        WriteWorkbookHolder workbookHolder = mockWorkbookHolder(workbook, MissingDictRow.class);
        WriteSheetHolder sheetHolder = Mockito.mock(WriteSheetHolder.class);
        when(sheetHolder.getSheet()).thenReturn(mainSheet);

        assertThrows(ServiceException.class, () -> handler.afterSheetCreate(workbookHolder, sheetHolder));
    }

    @Test
    @DisplayName("afterSheetCreate: should parse readConverterExp options")
    void afterSheetCreateShouldParseReadConverterExp() {
        ExcelDownHandler handler = new ExcelDownHandler(List.of());
        Workbook workbook = new XSSFWorkbook();
        Sheet mainSheet = workbook.createSheet("main");

        WriteWorkbookHolder workbookHolder = mockWorkbookHolder(workbook, ConverterExpRow.class);
        WriteSheetHolder sheetHolder = Mockito.mock(WriteSheetHolder.class);
        when(sheetHolder.getSheet()).thenReturn(mainSheet);

        handler.afterSheetCreate(workbookHolder, sheetHolder);

        assertFalse(mainSheet.getDataValidations().isEmpty());
    }

    @Test
    @DisplayName("private helpers: should resolve column name and support hssf validation branch")
    void privateHelpersShouldResolveColumnNameAndSupportHssfValidationBranch() throws Exception {
        ExcelDownHandler handler = new ExcelDownHandler(List.of());

        Method columnMethod = ExcelDownHandler.class.getDeclaredMethod("getExcelColumnName", int.class);
        columnMethod.setAccessible(true);
        assertEquals("A", columnMethod.invoke(handler, 0));
        assertEquals("AB", columnMethod.invoke(handler, 27));

        Workbook workbook = new HSSFWorkbook();
        Sheet sheet = workbook.createSheet("hssf");
        DataValidationHelper helper = sheet.getDataValidationHelper();
        DataValidationConstraint constraint = helper.createExplicitListConstraint(new String[]{"A", "B"});
        CellRangeAddressList addressList = new CellRangeAddressList(0, 0, 0, 0);

        Method markMethod = ExcelDownHandler.class.getDeclaredMethod(
            "markDataValidationToSheet",
            DataValidationHelper.class,
            Sheet.class,
            DataValidationConstraint.class,
            CellRangeAddressList.class
        );
        markMethod.setAccessible(true);
        markMethod.invoke(handler, helper, sheet, constraint, addressList);

        assertFalse(sheet.getDataValidations().isEmpty());
    }

    private static WriteWorkbookHolder mockWorkbookHolder(Workbook workbook, Class<?> clazz) {
        WriteWorkbookHolder workbookHolder = Mockito.mock(WriteWorkbookHolder.class);
        when(workbookHolder.getWorkbook()).thenReturn(workbook);
        Mockito.doReturn(clazz).when(workbookHolder).getClazz();

        GlobalConfiguration globalConfiguration = new GlobalConfiguration();
        globalConfiguration.setFiledCacheLocation(CacheLocationEnum.MEMORY);
        when(workbookHolder.globalConfiguration()).thenReturn(globalConfiguration);
        return workbookHolder;
    }

    private static class DemoRow {

        @ExcelProperty("字典列")
        @ExcelDictFormat(dictType = "gender")
        private String dictField;

        @ExcelProperty("枚举列")
        @ExcelEnumFormat(enumClass = GenderEnum.class)
        private Integer enumField;

        @ExcelProperty("动态列")
        @ExcelDynamicOptions(providerClass = DemoOptionsProvider.class)
        private String dynamicField;
    }

    private static class MissingDictRow {

        @ExcelProperty("字典列")
        @ExcelDictFormat(dictType = "missing_dict")
        private String dictField;
    }

    private static class ConverterExpRow {

        @ExcelProperty("状态")
        @ExcelDictFormat(readConverterExp = "1=启用,0=停用")
        private String status;
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

    private static class DemoOptionsProvider implements ExcelOptionsProvider {

        @Override
        public Set<String> getOptions() {
            return Set.of("动态1", "动态2");
        }
    }
}
