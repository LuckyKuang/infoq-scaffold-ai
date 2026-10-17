package cc.infoq.common.web.handler;

import cc.infoq.common.domain.ApiResult;
import cc.infoq.common.exception.ServiceException;
import cc.infoq.common.exception.SseException;
import cc.infoq.common.exception.base.BaseException;
import cc.infoq.common.utils.SpringUtils;
import com.fasterxml.jackson.core.JsonParseException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.context.MessageSourceResolvable;
import org.springframework.context.support.DefaultMessageSourceResolvable;
import org.springframework.http.HttpInputMessage;
import org.springframework.context.support.GenericApplicationContext;
import org.springframework.core.MethodParameter;
import org.springframework.expression.ExpressionException;
import org.springframework.expression.spel.SpelEvaluationException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.BeanPropertyBindingResult;
import org.springframework.validation.BindException;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingPathVariableException;
import org.springframework.web.context.request.async.AsyncRequestTimeoutException;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.NoHandlerFoundException;

import java.io.IOException;
import java.lang.reflect.Method;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

@Tag("dev")
class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @BeforeAll
    static void initSpringContext() {
        GenericApplicationContext context = new GenericApplicationContext();
        context.registerBean(ObjectMapper.class, () -> new ObjectMapper());
        context.refresh();
        new SpringUtils().setApplicationContext(context);
    }

    @Test
    @DisplayName("handleServiceException: should use custom code when provided")
    void handleServiceExceptionShouldUseCustomCode() {
        HttpServletRequest request = Mockito.mock(HttpServletRequest.class);
        ApiResult<Void> result = handler.handleServiceException(new ServiceException("biz error", 409), request);
        assertEquals(409, result.getCode());
        assertEquals("biz error", result.getMsg());
    }

    @Test
    @DisplayName("handleHttpRequestMethodNotSupported/NoHandlerFound: should map to expected status code")
    void requestRouteExceptionsShouldReturnExpectedStatus() throws Exception {
        HttpServletRequest request = Mockito.mock(HttpServletRequest.class);
        Mockito.when(request.getRequestURI()).thenReturn("/api/demo");

        ApiResult<Void> badMethod = handler.handleHttpRequestMethodNotSupported(
            new HttpRequestMethodNotSupportedException("POST", List.of("GET")), request);
        ApiResult<Void> notFound = handler.handleNoHandlerFoundException(
            new NoHandlerFoundException("GET", "/missing", new HttpHeaders()), request);

        assertEquals(405, badMethod.getCode());
        assertEquals(404, notFound.getCode());
    }

    @Test
    @DisplayName("handleBindException/constraintViolation: should aggregate validation messages")
    void validationExceptionsShouldAggregateMessages() {
        BindException bindException = new BindException(new Object(), "obj");
        bindException.addError(new FieldError("obj", "name", "name is required"));

        ConstraintViolation<?> violation = constraintViolation("age must be positive");
        ConstraintViolationException constraintViolationException = new ConstraintViolationException(Set.of(violation));

        ApiResult<Void> bindResult = handler.handleBindException(bindException);
        ApiResult<Void> violationResult = handler.constraintViolationException(constraintViolationException);

        assertEquals(500, bindResult.getCode());
        assertTrue(bindResult.getMsg().contains("name is required"));
        assertTrue(violationResult.getMsg().contains("age must be positive"));
    }

    @Test
    @DisplayName("handleMethodArgumentTypeMismatch/MissingPathVariable: should include details in message")
    void argumentExceptionsShouldIncludeDetails() throws Exception {
        HttpServletRequest request = Mockito.mock(HttpServletRequest.class);
        Mockito.when(request.getRequestURI()).thenReturn("/api/users/{id}");

        MethodArgumentTypeMismatchException typeMismatch = new MethodArgumentTypeMismatchException(
            "abc", Integer.class, "id", null, null);
        ApiResult<Void> mismatchResult = handler.handleMethodArgumentTypeMismatchException(typeMismatch, request);

        MissingPathVariableException missingPath = new MissingPathVariableException("id", null);
        ApiResult<Void> pathResult = handler.handleMissingPathVariableException(missingPath, request);

        assertTrue(mismatchResult.getMsg().contains("id"));
        assertTrue(pathResult.getMsg().contains("id"));
    }

    @Test
    @DisplayName("handleJsonParse/HttpMessageNotReadable/SpEL: should map parse failures")
    void parseExceptionsShouldMapToBadRequestOrInternalError() {
        HttpServletRequest request = Mockito.mock(HttpServletRequest.class);
        Mockito.when(request.getRequestURI()).thenReturn("/api/body");

        ApiResult<Void> jsonParse = handler.handleJsonParseException(new JsonParseException(null, "invalid json"), request);
        HttpInputMessage httpInputMessage = Mockito.mock(HttpInputMessage.class);
        ApiResult<Void> bodyParse = handler.handleHttpMessageNotReadableException(
            new HttpMessageNotReadableException("bad body", httpInputMessage), request);
        ApiResult<Void> spel = handler.handleSpelException(
            new SpelEvaluationException(org.springframework.expression.spel.SpelMessage.TYPE_CONVERSION_ERROR, "spel"), request);

        assertEquals(400, jsonParse.getCode());
        assertEquals(400, bodyParse.getCode());
        assertEquals(500, spel.getCode());
    }

    @Test
    @DisplayName("authentication/servlet/base exceptions: should map to expected error payload")
    void securityAndBaseExceptionsShouldMapToExpectedPayload() {
        HttpServletRequest request = Mockito.mock(HttpServletRequest.class);
        Mockito.when(request.getRequestURI()).thenReturn("/api/sse/connect");

        String unauthorizedJson = handler.handleAuthenticationException(new SseException("token invalid"), request);
        ApiResult<Void> servletResult = handler.handleServletException(new ServletException("servlet failed"), request);
        ApiResult<Void> baseResult = handler.handleBaseException(new BaseException("base failed"), request);

        assertTrue(unauthorizedJson.contains("\"code\":401"));
        assertEquals("servlet failed", servletResult.getMsg());
        assertEquals("base failed", baseResult.getMsg());
    }

    @Test
    @DisplayName("handleMethodArgumentNotValid/handlerMethodValidation: should aggregate message source errors")
    void methodValidationExceptionsShouldAggregateMessages() throws Exception {
        Method method = ValidationTarget.class.getDeclaredMethod("accept", String.class);
        MethodParameter methodParameter = new MethodParameter(method, 0);
        BeanPropertyBindingResult bindingResult = new BeanPropertyBindingResult(new Object(), "target");
        bindingResult.addError(new FieldError("target", "name", "name invalid"));
        MethodArgumentNotValidException argumentNotValidException =
            new MethodArgumentNotValidException(methodParameter, bindingResult);

        HandlerMethodValidationException methodValidationException = Mockito.mock(HandlerMethodValidationException.class);
        Mockito.when(methodValidationException.getMessage()).thenReturn("validation failed");
        MessageSourceResolvable messageSourceResolvable =
            new DefaultMessageSourceResolvable(new String[]{"target.age.invalid"}, null, "age invalid");
        Mockito.doReturn(List.of(messageSourceResolvable)).when(methodValidationException).getAllErrors();

        ApiResult<Void> argumentResult = handler.handleMethodArgumentNotValidException(argumentNotValidException);
        ApiResult<Void> methodResult = handler.handlerMethodValidationException(methodValidationException);

        assertTrue(argumentResult.getMsg().contains("name invalid"));
        assertTrue(methodResult.getMsg().contains("age invalid"));
    }

    @Test
    @DisplayName("handleIoException/timeout/runtime/exception: should not throw and return fail result")
    void genericExceptionHandlersShouldWork() {
        HttpServletRequest sseRequest = Mockito.mock(HttpServletRequest.class);
        Mockito.when(sseRequest.getRequestURI()).thenReturn("/api/sse/connect");
        HttpServletRequest normalRequest = Mockito.mock(HttpServletRequest.class);
        Mockito.when(normalRequest.getRequestURI()).thenReturn("/api/jobs");

        assertDoesNotThrow(() -> handler.handleIoException(new IOException("stream closed"), sseRequest));
        assertDoesNotThrow(() -> handler.handleIoException(new IOException("stream closed"), normalRequest));
        assertDoesNotThrow(() -> handler.handleRuntimeException(new AsyncRequestTimeoutException()));

        ApiResult<Void> runtime = handler.handleRuntimeException(new RuntimeException("boom"), normalRequest);
        ApiResult<Void> generic = handler.handleException(new Exception("system"), normalRequest);

        assertEquals(500, runtime.getCode());
        assertEquals("boom", runtime.getMsg());
        assertEquals("system", generic.getMsg());
    }

    @Test
    @DisplayName("handleSpelException: should handle base expression exception instance")
    void handleSpelExceptionShouldHandleExpressionException() {
        HttpServletRequest request = Mockito.mock(HttpServletRequest.class);
        Mockito.when(request.getRequestURI()).thenReturn("/api/expr");

        ApiResult<Void> result = handler.handleSpelException(new ExpressionException("spel error"), request);

        assertEquals(500, result.getCode());
        assertTrue(result.getMsg().contains("spel error"));
    }

    private static final class ValidationTarget {
        private void accept(String name) {
        }
    }

    private static ConstraintViolation<?> constraintViolation(String message) {
        return (ConstraintViolation<?>) java.lang.reflect.Proxy.newProxyInstance(
            GlobalExceptionHandlerTest.class.getClassLoader(),
            new Class<?>[]{ConstraintViolation.class},
            (proxy, method, args) -> {
                return switch (method.getName()) {
                    case "getMessage" -> message;
                    case "hashCode" -> System.identityHashCode(proxy);
                    case "equals" -> proxy == args[0];
                    case "toString" -> "ConstraintViolation[" + message + "]";
                    default -> method.getReturnType().isPrimitive() ? primitiveDefault(method.getReturnType()) : null;
                };
            }
        );
    }

    private static Object primitiveDefault(Class<?> type) {
        if (type == boolean.class) {
            return false;
        }
        if (type == byte.class) {
            return (byte) 0;
        }
        if (type == short.class) {
            return (short) 0;
        }
        if (type == int.class) {
            return 0;
        }
        if (type == long.class) {
            return 0L;
        }
        if (type == float.class) {
            return 0F;
        }
        if (type == double.class) {
            return 0D;
        }
        if (type == char.class) {
            return '\0';
        }
        throw new IllegalArgumentException("Unsupported primitive type: " + type);
    }
}
