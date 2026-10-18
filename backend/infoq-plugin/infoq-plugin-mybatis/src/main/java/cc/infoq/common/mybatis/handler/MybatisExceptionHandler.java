package cc.infoq.common.mybatis.handler;

import cc.infoq.common.domain.ApiResult;
import cc.infoq.common.security.auth.SecurityAuthenticationException;
import cc.infoq.common.utils.StringUtils;
import cn.hutool.http.HttpStatus;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.mybatis.spring.MyBatisSystemException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Mybatis异常处理器
 *
 * @author Pontus
 */
@Slf4j
@RestControllerAdvice
public class MybatisExceptionHandler {

    /**
     * 主键或UNIQUE索引，数据重复异常
     */
    @ExceptionHandler(DuplicateKeyException.class)
    public ApiResult<Void> handleDuplicateKeyException(DuplicateKeyException e, HttpServletRequest request) {
        String requestURI = request.getRequestURI();
        log.error("请求地址'{}',数据库中已存在记录'{}'", requestURI, e.getMessage());
        return ApiResult.fail(HttpStatus.HTTP_CONFLICT, "数据库中已存在该记录，请联系管理员确认");
    }

    /**
     * Mybatis系统异常 通用处理
     */
    @ExceptionHandler(MyBatisSystemException.class)
    public ApiResult<Void> handleCannotFindDataSourceException(MyBatisSystemException e, HttpServletRequest request) {
        String requestURI = request.getRequestURI();
        String message = e.getMessage();
        if (containsCause(e, SecurityAuthenticationException.class)) {
            log.error("请求地址'{}',认证失败'{}',无法访问系统资源", requestURI, e.getMessage());
            return ApiResult.fail(HttpStatus.HTTP_UNAUTHORIZED, "认证失败，无法访问系统资源");
        }
        if (StringUtils.contains(message, "CannotFindDataSourceException")) {
            log.error("请求地址'{}', 未找到数据源", requestURI);
            return ApiResult.fail(HttpStatus.HTTP_INTERNAL_ERROR, "未找到数据源，请联系管理员确认");
        }
        log.error("请求地址'{}', Mybatis系统异常", requestURI, e);
        return ApiResult.fail(HttpStatus.HTTP_INTERNAL_ERROR, message);
    }

    /**
     * 认证上下文异常 通用处理
     */
    @ExceptionHandler(SecurityAuthenticationException.class)
    public ApiResult<Void> handleSecurityAuthenticationException(SecurityAuthenticationException e, HttpServletRequest request) {
        String requestURI = request.getRequestURI();
        log.error("请求地址'{}',认证失败'{}',无法访问系统资源", requestURI, e.getMessage());
        return ApiResult.fail(HttpStatus.HTTP_UNAUTHORIZED, "认证失败，无法访问系统资源");
    }

    private boolean containsCause(Throwable throwable, Class<? extends Throwable> targetType) {
        Throwable current = throwable;
        while (current != null) {
            if (targetType.isInstance(current)) {
                return true;
            }
            current = current.getCause();
        }
        return false;
    }

}
