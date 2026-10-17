package cc.infoq.common.redis.handler;

import cc.infoq.common.domain.ApiResult;
import cn.hutool.http.HttpStatus;
import com.baomidou.lock.exception.LockFailureException;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Redis异常处理器
 *
 * @author Pontus
 */
@Slf4j
@RestControllerAdvice
public class RedisExceptionHandler {

    /**
     * 分布式锁Lock4j异常
     */
    @ExceptionHandler(LockFailureException.class)
    public ApiResult<Void> handleLockFailureException(LockFailureException e, HttpServletRequest request) {
        String requestURI = request.getRequestURI();
        log.error("获取锁失败了'{}',发生Lock4j异常.", requestURI, e);
        return ApiResult.fail(HttpStatus.HTTP_UNAVAILABLE, "业务处理中，请稍后再试...");
    }

}
