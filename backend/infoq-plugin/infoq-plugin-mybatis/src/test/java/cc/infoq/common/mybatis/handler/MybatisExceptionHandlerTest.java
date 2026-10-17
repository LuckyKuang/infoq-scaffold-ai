package cc.infoq.common.mybatis.handler;

import cc.infoq.common.domain.ApiResult;
import cc.infoq.common.security.auth.SecurityAuthenticationException;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.mybatis.spring.MyBatisSystemException;
import org.springframework.dao.DuplicateKeyException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@Tag("dev")
class MybatisExceptionHandlerTest {

    private final MybatisExceptionHandler handler = new MybatisExceptionHandler();

    @Test
    @DisplayName("handleDuplicateKeyException: should map duplicate key to conflict result")
    void handleDuplicateKeyExceptionShouldMapToConflictResult() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn("/sys/user/add");

        ApiResult<Void> result = handler.handleDuplicateKeyException(
            new DuplicateKeyException("duplicate"), request);

        assertEquals(409, result.getCode());
        assertEquals("数据库中已存在该记录，请联系管理员确认", result.getMsg());
    }

    @Test
    @DisplayName("handleCannotFindDataSourceException: should map datasource missing message")
    void handleCannotFindDataSourceExceptionShouldMapDatasourceMissingMessage() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn("/sys/user/list");

        ApiResult<Void> result = handler.handleCannotFindDataSourceException(
            new MyBatisSystemException("CannotFindDataSourceException: missing", new RuntimeException("missing")),
            request);

        assertEquals(ApiResult.FAIL, result.getCode());
        assertEquals("未找到数据源，请联系管理员确认", result.getMsg());
    }

    @Test
    @DisplayName("handleCannotFindDataSourceException: should map security authentication cause")
    void handleCannotFindDataSourceExceptionShouldMapSecurityAuthenticationCause() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn("/sys/menu/list");

        ApiResult<Void> result = handler.handleCannotFindDataSourceException(
            new MyBatisSystemException("data permission auth failure",
                new SecurityAuthenticationException("Spring Security authentication is missing")),
            request);

        assertEquals(401, result.getCode());
        assertEquals("认证失败，无法访问系统资源", result.getMsg());
    }

    @Test
    @DisplayName("handleCannotFindDataSourceException: should not map legacy auth text")
    void handleCannotFindDataSourceExceptionShouldNotMapLegacyAuthText() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn("/sys/menu/list");

        ApiResult<Void> result = handler.handleCannotFindDataSourceException(
            new MyBatisSystemException("LegacyAuthException: token invalid", new RuntimeException("token invalid")),
            request);

        assertEquals(ApiResult.FAIL, result.getCode());
        assertEquals("LegacyAuthException: token invalid", result.getMsg());
    }

    @Test
    @DisplayName("handleSecurityAuthenticationException: should map direct security exception")
    void handleSecurityAuthenticationExceptionShouldMapDirectSecurityException() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn("/sys/menu/list");

        ApiResult<Void> result = handler.handleSecurityAuthenticationException(
            new SecurityAuthenticationException("Spring Security authentication is missing"), request);

        assertEquals(401, result.getCode());
        assertEquals("认证失败，无法访问系统资源", result.getMsg());
    }

    @Test
    @DisplayName("handleCannotFindDataSourceException: should fallback to original message for generic exception")
    void handleCannotFindDataSourceExceptionShouldFallbackToOriginalMessage() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn("/sys/dept/list");
        MyBatisSystemException ex = new MyBatisSystemException("other exception", new RuntimeException("cause"));

        ApiResult<Void> result = handler.handleCannotFindDataSourceException(ex, request);

        assertEquals(ApiResult.FAIL, result.getCode());
        assertEquals("other exception", result.getMsg());
    }
}
