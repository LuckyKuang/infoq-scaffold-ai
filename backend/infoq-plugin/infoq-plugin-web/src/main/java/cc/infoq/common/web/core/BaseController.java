package cc.infoq.common.web.core;

import cc.infoq.common.domain.ApiResult;
import cc.infoq.common.utils.StringUtils;

/**
 * web层通用数据处理
 *
 * @author Pontus
 */
public class BaseController {

    /**
     * 响应返回结果
     *
     * @param rows 影响行数
     * @return 操作结果
     */
    protected ApiResult<Void> toAjax(int rows) {
        return rows > 0 ? ApiResult.ok() : ApiResult.fail();
    }

    /**
     * 响应返回结果
     *
     * @param result 结果
     * @return 操作结果
     */
    protected ApiResult<Void> toAjax(boolean result) {
        return result ? ApiResult.ok() : ApiResult.fail();
    }

    /**
     * 页面跳转
     */
    public String redirect(String url) {
        return StringUtils.format("redirect:{}", url);
    }

}
