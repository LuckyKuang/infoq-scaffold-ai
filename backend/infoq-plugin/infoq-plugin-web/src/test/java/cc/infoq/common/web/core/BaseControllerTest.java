package cc.infoq.common.web.core;

import cc.infoq.common.domain.ApiResult;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

@Tag("dev")
class BaseControllerTest {

    private final TestController controller = new TestController();

    @Test
    @DisplayName("toAjax: should return success when affected rows greater than zero")
    void toAjaxRowsShouldReturnSuccessWhenRowsPositive() {
        ApiResult<Void> success = controller.rows(1);
        ApiResult<Void> failed = controller.rows(0);

        assertEquals(ApiResult.SUCCESS, success.getCode());
        assertEquals(ApiResult.FAIL, failed.getCode());
    }

    @Test
    @DisplayName("toAjax: should return success/fail by boolean result")
    void toAjaxBooleanShouldReturnByResult() {
        ApiResult<Void> success = controller.bool(true);
        ApiResult<Void> failed = controller.bool(false);

        assertEquals(ApiResult.SUCCESS, success.getCode());
        assertEquals(ApiResult.FAIL, failed.getCode());
    }

    @Test
    @DisplayName("redirect: should prefix redirect marker")
    void redirectShouldPrefixMarker() {
        assertEquals("redirect:/system/user", controller.redirect("/system/user"));
    }

    private static final class TestController extends BaseController {
        private ApiResult<Void> rows(int rows) {
            return super.toAjax(rows);
        }

        private ApiResult<Void> bool(boolean result) {
            return super.toAjax(result);
        }
    }
}
