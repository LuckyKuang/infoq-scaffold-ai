package cc.infoq.common.excel.utils;

import cc.infoq.common.service.DictService;
import cc.infoq.common.utils.SpringUtils;
import cc.infoq.common.excel.core.DefaultExcelListener;
import cc.infoq.common.excel.core.DropDownOptions;
import cc.infoq.common.excel.core.ExcelResult;
import cn.idev.excel.ExcelWriter;
import cn.idev.excel.FastExcel;
import cn.idev.excel.annotation.ExcelProperty;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.context.support.GenericApplicationContext;
import org.springframework.mock.web.MockHttpServletResponse;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@Tag("dev")
class ExcelUtilTest {

    private static final String TEMPLATE_PATH = "excel/unit-template.xlsx";
    private static GenericApplicationContext context;

    @BeforeAll
    static void prepareTemplate() throws IOException {
        context = new GenericApplicationContext();
        context.registerBean(DictService.class, () -> Mockito.mock(DictService.class));
        context.registerBean(Validator.class, () -> Validation.buildDefaultValidatorFactory().getValidator());
        context.refresh();
        new SpringUtils().setApplicationContext(context);

        Path template = Path.of("target", "test-classes", TEMPLATE_PATH);
        Files.createDirectories(template.getParent());
        List<Map<String, Object>> seed = new ArrayList<>();
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("name", "{name}");
        row.put("listName", "{list.name}");
        seed.add(row);
        try (OutputStream outputStream = Files.newOutputStream(template)) {
            try (ExcelWriter writer = FastExcel.write(outputStream).build()) {
                writer.write(seed, FastExcel.writerSheet(0, "Sheet1").build());
                writer.write(seed, FastExcel.writerSheet(1, "Sheet2").build());
            }
        }
    }

    @AfterAll
    static void tearDownContext() {
        if (context != null) {
            context.close();
        }
    }

    @Test
    @DisplayName("convertByExp/reverseByExp: should map enum-like values bi-directionally")
    void convertByExpAndReverseByExpShouldWork() {
        String exp = "0=男,1=女,2=未知";
        assertEquals("男", ExcelUtil.convertByExp("0", exp, ","));
        assertEquals("男,女", ExcelUtil.convertByExp("0,1", exp, ","));
        assertEquals("1", ExcelUtil.reverseByExp("女", exp, ","));
        assertEquals("1,2", ExcelUtil.reverseByExp("女,未知", exp, ","));
    }

    @Test
    @DisplayName("encodingFilename: should append .xlsx suffix with random prefix")
    void encodingFilenameShouldReturnExpectedPattern() {
        String filename = ExcelUtil.encodingFilename("report");
        assertTrue(filename.endsWith("_report.xlsx"));
        assertTrue(filename.length() > "_report.xlsx".length());
    }

    @Test
    @DisplayName("exportExcel: should support stream/response overloads and custom writer")
    void exportExcelOverloadsShouldWork() {
        List<DemoRow> rows = demoRows();
        List<DropDownOptions> options = List.of(new DropDownOptions(0, List.of("A", "B")));

        ByteArrayOutputStream plainStream = new ByteArrayOutputStream();
        ExcelUtil.exportExcel(rows, "users", DemoRow.class, plainStream);
        assertTrue(plainStream.size() > 0);

        ByteArrayOutputStream streamWithOptions = new ByteArrayOutputStream();
        ExcelUtil.exportExcel(rows, "users", DemoRow.class, true, streamWithOptions, options);
        assertTrue(streamWithOptions.size() > 0);

        ByteArrayOutputStream streamWithOptionOverload = new ByteArrayOutputStream();
        ExcelUtil.exportExcel(rows, "users", DemoRow.class, streamWithOptionOverload, options);
        assertTrue(streamWithOptionOverload.size() > 0);

        MockHttpServletResponse response = new MockHttpServletResponse();
        ExcelUtil.exportExcel(rows, "users", DemoRow.class, response);
        assertTrue(response.getContentAsByteArray().length > 0);

        MockHttpServletResponse responseWithOptions = new MockHttpServletResponse();
        ExcelUtil.exportExcel(rows, "users", DemoRow.class, responseWithOptions, options);
        assertTrue(responseWithOptions.getContentAsByteArray().length > 0);

        MockHttpServletResponse mergeResponseNoOptions = new MockHttpServletResponse();
        ExcelUtil.exportExcel(rows, "users", DemoRow.class, true, mergeResponseNoOptions);
        assertTrue(mergeResponseNoOptions.getContentAsByteArray().length > 0);

        MockHttpServletResponse mergeResponse = new MockHttpServletResponse();
        ExcelUtil.exportExcel(rows, "users", DemoRow.class, true, mergeResponse, options);
        assertTrue(mergeResponse.getContentAsByteArray().length > 0);

        ByteArrayOutputStream customWriterWithoutOptions = new ByteArrayOutputStream();
        ExcelUtil.exportExcel(DemoRow.class, customWriterWithoutOptions, writer ->
            writer.write(rows, ExcelWriterWrapper.buildSheet("users")));
        assertTrue(customWriterWithoutOptions.size() > 0);

        ByteArrayOutputStream customWriter = new ByteArrayOutputStream();
        ExcelUtil.exportExcel(rows, "users", DemoRow.class, response, options);
        ExcelUtil.exportExcel(DemoRow.class, customWriter, options, writer ->
            writer.write(rows, ExcelWriterWrapper.buildSheet(0, "users")));
        assertTrue(customWriter.size() > 0);

        RuntimeException exception = assertThrows(RuntimeException.class,
            () -> ExcelUtil.exportExcel(DemoRow.class, new ByteArrayOutputStream(), options,
                writer -> {
                    throw new IllegalStateException("boom");
                }));
        assertTrue(exception.getMessage().contains("boom"));
    }

    @Test
    @DisplayName("importExcel: should support sync, validate-listener and custom listener overloads")
    void importExcelOverloadsShouldWork() {
        List<DemoRow> rows = demoRows();
        byte[] bytes;
        try (ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {
            FastExcel.write(outputStream, DemoRow.class).sheet("users").doWrite(rows);
            bytes = outputStream.toByteArray();
        } catch (IOException e) {
            throw new AssertionError("build import file failed", e);
        }

        List<DemoRow> syncRows = ExcelUtil.importExcel(new ByteArrayInputStream(bytes), DemoRow.class);
        assertEquals(2, syncRows.size());

        ExcelResult<DemoRow> validateResult = ExcelUtil.importExcel(new ByteArrayInputStream(bytes), DemoRow.class, true);
        assertEquals(2, validateResult.getList().size());

        DefaultExcelListener<DemoRow> listener = new DefaultExcelListener<>(false);
        ExcelResult<DemoRow> customResult = ExcelUtil.importExcel(new ByteArrayInputStream(bytes), DemoRow.class, listener);
        assertEquals(2, customResult.getList().size());
    }

    @Test
    @DisplayName("template exports: should support template/list/sheet paths")
    void templateExportVariantsShouldWork() {
        List<DemoRow> rows = demoRows();
        Map<String, Object> multiListData = new LinkedHashMap<>();
        multiListData.put("list", rows);
        multiListData.put("name", "summary");

        List<Map<String, Object>> multiSheetData = List.of(
            new LinkedHashMap<>(multiListData),
            Map.of("name", "sheet-2", "list", List.of(new DemoRow("charlie", "C")))
        );

        ByteArrayOutputStream templateStream = new ByteArrayOutputStream();
        ExcelUtil.exportTemplate(rows, TEMPLATE_PATH, templateStream);
        assertTrue(templateStream.size() > 0);

        MockHttpServletResponse templateResponse = new MockHttpServletResponse();
        ExcelUtil.exportTemplate(rows, "tpl", TEMPLATE_PATH, templateResponse);
        assertTrue(templateResponse.getContentAsByteArray().length > 0);

        ByteArrayOutputStream multiListStream = new ByteArrayOutputStream();
        ExcelUtil.exportTemplateMultiList(multiListData, TEMPLATE_PATH, multiListStream);
        assertTrue(multiListStream.size() > 0);

        MockHttpServletResponse multiListResponse = new MockHttpServletResponse();
        ExcelUtil.exportTemplateMultiList(multiListData, "tpl-multi", TEMPLATE_PATH, multiListResponse);
        assertTrue(multiListResponse.getContentAsByteArray().length > 0);

        ByteArrayOutputStream multiSheetStream = new ByteArrayOutputStream();
        ExcelUtil.exportTemplateMultiSheet(multiSheetData, TEMPLATE_PATH, multiSheetStream);
        assertTrue(multiSheetStream.size() > 0);

        MockHttpServletResponse multiSheetResponse = new MockHttpServletResponse();
        ExcelUtil.exportTemplateMultiSheet(multiSheetData, "tpl-sheet", TEMPLATE_PATH, multiSheetResponse);
        assertTrue(multiSheetResponse.getContentAsByteArray().length > 0);
    }

    @Test
    @DisplayName("response and empty guards: should throw expected exceptions")
    void responseAndEmptyGuardBranchesShouldThrowExpectedExceptions() throws IOException {
        List<DemoRow> rows = demoRows();
        Map<String, Object> multiListData = Map.of("list", rows);
        List<Map<String, Object>> multiSheetData = List.of(Map.of("list", rows));

        HttpServletResponse brokenResponse = mock(HttpServletResponse.class);
        when(brokenResponse.getOutputStream()).thenThrow(new IOException("io"));

        assertThrows(RuntimeException.class, () -> ExcelUtil.exportExcel(rows, "users", DemoRow.class, brokenResponse));
        assertThrows(RuntimeException.class, () -> ExcelUtil.exportExcel(rows, "users", DemoRow.class, brokenResponse, null));
        assertThrows(RuntimeException.class, () -> ExcelUtil.exportExcel(rows, "users", DemoRow.class, true, brokenResponse));
        assertThrows(RuntimeException.class, () -> ExcelUtil.exportExcel(rows, "users", DemoRow.class, true, brokenResponse, null));
        assertThrows(RuntimeException.class, () -> ExcelUtil.exportTemplate(rows, "tpl", TEMPLATE_PATH, brokenResponse));
        assertThrows(RuntimeException.class, () -> ExcelUtil.exportTemplateMultiList(multiListData, "tpl", TEMPLATE_PATH, brokenResponse));
        assertThrows(RuntimeException.class, () -> ExcelUtil.exportTemplateMultiSheet(multiSheetData, "tpl", TEMPLATE_PATH, brokenResponse));

        assertThrows(IllegalArgumentException.class, () -> ExcelUtil.exportTemplate(List.of(), "tpl", TEMPLATE_PATH, new MockHttpServletResponse()));
        assertThrows(IllegalArgumentException.class, () -> ExcelUtil.exportTemplateMultiList(Map.of(), "tpl", TEMPLATE_PATH, new MockHttpServletResponse()));
        assertThrows(IllegalArgumentException.class, () -> ExcelUtil.exportTemplateMultiSheet(List.of(), "tpl", TEMPLATE_PATH, new MockHttpServletResponse()));
    }

    private static List<DemoRow> demoRows() {
        return List.of(new DemoRow("alice", "A"), new DemoRow("bob", "B"));
    }

    public static class DemoRow {
        @ExcelProperty("name")
        private String name;
        @ExcelProperty("level")
        private String level;

        public DemoRow() {
        }

        public DemoRow(String name, String level) {
            this.name = name;
            this.level = level;
        }

        public String getName() {
            return name;
        }

        public String getLevel() {
            return level;
        }
    }
}
