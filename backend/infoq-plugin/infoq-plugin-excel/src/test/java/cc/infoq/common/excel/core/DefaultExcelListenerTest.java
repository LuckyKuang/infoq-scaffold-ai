package cc.infoq.common.excel.core;

import cc.infoq.common.utils.SpringUtils;
import cn.idev.excel.context.AnalysisContext;
import cn.idev.excel.exception.ExcelAnalysisException;
import cn.idev.excel.exception.ExcelDataConvertException;
import cn.idev.excel.metadata.data.ReadCellData;
import cn.idev.excel.read.metadata.holder.ReadRowHolder;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.context.support.GenericApplicationContext;

import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@Tag("dev")
class DefaultExcelListenerTest {

    @BeforeAll
    static void initSpringContext() {
        GenericApplicationContext context = new GenericApplicationContext();
        context.registerBean(ObjectMapper.class, () -> new ObjectMapper());
        context.refresh();
        new SpringUtils().setApplicationContext(context);
    }

    @Test
    @DisplayName("onException: should build row/column error for data convert exception")
    void onExceptionShouldBuildConvertError() throws Exception {
        DefaultExcelListener<String> listener = new DefaultExcelListener<>(false);
        AnalysisContext context = Mockito.mock(AnalysisContext.class);
        listener.invokeHeadMap(Map.of(0, "姓名"), context);

        ExcelDataConvertException exception = new ExcelDataConvertException(
            0,
            0,
            new ReadCellData<>("x"),
            null,
            "convert failed"
        );

        assertThrows(ExcelAnalysisException.class, () -> listener.onException(exception, context));
        assertEquals(1, listener.getExcelResult().getErrorList().size());
        assertEquals("第1行-第1列-表头姓名: 解析异常<br/>", listener.getExcelResult().getErrorList().get(0));
    }

    @Test
    @DisplayName("onException: should build row error for constraint violation")
    void onExceptionShouldBuildConstraintViolationError() throws Exception {
        DefaultExcelListener<String> listener = new DefaultExcelListener<>(false);
        ConstraintViolation<?> violation = Mockito.mock(ConstraintViolation.class);
        when(violation.getMessage()).thenReturn("不能为空");

        ReadRowHolder readRowHolder = Mockito.mock(ReadRowHolder.class);
        when(readRowHolder.getRowIndex()).thenReturn(4);
        AnalysisContext context = Mockito.mock(AnalysisContext.class);
        when(context.readRowHolder()).thenReturn(readRowHolder);

        ConstraintViolationException exception = new ConstraintViolationException(Set.of(violation));
        assertThrows(ExcelAnalysisException.class, () -> listener.onException(exception, context));
        assertEquals("第5行数据校验异常: 不能为空", listener.getExcelResult().getErrorList().get(0));
    }

    @Test
    @DisplayName("invoke/getAnalysis: should append rows without validation when disabled")
    void invokeShouldAppendRowsWhenValidationDisabled() {
        DefaultExcelListener<String> listener = new DefaultExcelListener<>(false);
        listener.invoke("row-1", Mockito.mock(AnalysisContext.class));
        listener.invoke("row-2", Mockito.mock(AnalysisContext.class));
        listener.doAfterAllAnalysed(Mockito.mock(AnalysisContext.class));

        assertEquals(2, listener.getExcelResult().getList().size());
        assertEquals("恭喜您，全部读取成功！共2条", listener.getExcelResult().getAnalysis());
    }
}
