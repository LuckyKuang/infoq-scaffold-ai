package cc.infoq.common.excel.core;

import java.util.List;

/**
 * excel返回对象
 *
 * @author Pontus
 */
public interface ExcelResult<T> {

    /**
     * 对象列表
     */
    List<T> getList();

    /**
     * 错误列表
     */
    List<String> getErrorList();

    /**
     * 导入回执
     */
    String getAnalysis();
}
