package cc.infoq.common.excel.core;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Tag("dev")
class DefaultExcelResultTest {

    @Test
    @DisplayName("constructors: should support default/list/copy variants")
    void constructorsShouldWork() {
        DefaultExcelResult<String> empty = new DefaultExcelResult<>();
        assertTrue(empty.getList().isEmpty());
        assertTrue(empty.getErrorList().isEmpty());
        assertEquals("读取失败，未解析到数据", empty.getAnalysis());

        DefaultExcelResult<String> success = new DefaultExcelResult<>(List.of("a", "b"), List.of());
        assertEquals("恭喜您，全部读取成功！共2条", success.getAnalysis());

        ExcelResult<String> source = new DefaultExcelResult<>(List.of("x"), List.of("e1"));
        DefaultExcelResult<String> copied = new DefaultExcelResult<>(source);
        assertEquals(List.of("x"), copied.getList());
        assertEquals(List.of("e1"), copied.getErrorList());
        assertEquals("", copied.getAnalysis());
    }
}
