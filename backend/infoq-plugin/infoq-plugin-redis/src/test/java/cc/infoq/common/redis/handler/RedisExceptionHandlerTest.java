package cc.infoq.common.redis.handler;

import cc.infoq.common.domain.ApiResult;
import cn.hutool.http.HttpStatus;
import com.baomidou.lock.exception.LockFailureException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.junit.jupiter.api.Assertions.assertEquals;

@Tag("dev")
class RedisExceptionHandlerTest {

    @Test
    @DisplayName("handleLockFailureException: should return 503 with retry message")
    void handleLockFailureExceptionShouldReturnServiceUnavailable() {
        RedisExceptionHandler handler = new RedisExceptionHandler();
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRequestURI("/system/order/create");

        ApiResult<Void> result = handler.handleLockFailureException(
            new LockFailureException("lock failed"),
            request
        );

        assertEquals(HttpStatus.HTTP_UNAVAILABLE, result.getCode());
        assertEquals("业务处理中，请稍后再试...", result.getMsg());
    }
}
