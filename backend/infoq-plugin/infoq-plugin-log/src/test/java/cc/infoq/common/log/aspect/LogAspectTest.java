package cc.infoq.common.log.aspect;

import cc.infoq.common.domain.model.LoginUser;
import cc.infoq.common.log.annotation.Log;
import cc.infoq.common.log.enums.BusinessType;
import cc.infoq.common.log.event.OperLogEvent;
import cc.infoq.common.security.auth.LoginUserContext;
import cc.infoq.common.utils.ServletUtils;
import cc.infoq.common.utils.SpringUtils;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.Signature;
import org.junit.jupiter.api.*;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.springframework.context.ApplicationContext;
import org.springframework.context.support.GenericApplicationContext;
import org.springframework.validation.BindingResult;
import org.springframework.web.multipart.MultipartFile;

import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@Tag("dev")
class LogAspectTest {

    private final LogAspect logAspect = new LogAspect();
    private static GenericApplicationContext context;

    @BeforeAll
    static void initSpringContext() {
        context = new GenericApplicationContext();
        context.registerBean(ObjectMapper.class, () -> new ObjectMapper());
        context.refresh();
        new SpringUtils().setApplicationContext(context);
    }

    @AfterAll
    static void closeSpringContext() {
        if (context != null) {
            context.close();
        }
    }

    @Test
    @DisplayName("isFilterObject: should filter servlet and multipart payloads")
    void isFilterObjectShouldFilterSpecialPayloads() {
        MultipartFile file = mock(MultipartFile.class);

        assertTrue(logAspect.isFilterObject(mock(HttpServletRequest.class)));
        assertTrue(logAspect.isFilterObject(mock(HttpServletResponse.class)));
        assertTrue(logAspect.isFilterObject(mock(BindingResult.class)));
        assertTrue(logAspect.isFilterObject(file));
        assertTrue(logAspect.isFilterObject(new MultipartFile[]{file}));
        assertTrue(logAspect.isFilterObject(List.of(file)));
        assertTrue(logAspect.isFilterObject(Map.of("file", file)));

        assertFalse(logAspect.isFilterObject("plain"));
    }

    @Test
    @DisplayName("getControllerMethodDescription: should map annotation metadata")
    void getControllerMethodDescriptionShouldMapAnnotationMetadata() throws Exception {
        Method method = DemoController.class.getDeclaredMethod("demoMethod");
        Log log = method.getAnnotation(Log.class);

        JoinPoint joinPoint = mock(JoinPoint.class);
        when(joinPoint.getArgs()).thenReturn(new Object[0]);

        OperLogEvent operLog = new OperLogEvent();
        operLog.setRequestMethod("GET");

        logAspect.getControllerMethodDescription(joinPoint, log, operLog, null);

        assertEquals("demo", operLog.getTitle());
        assertEquals(BusinessType.UPDATE.ordinal(), operLog.getBusinessType());
        assertNull(operLog.getJsonResult());
    }

    @Test
    @DisplayName("argsArrayToString: should sanitize excluded fields in map/list payloads")
    void argsArrayToStringShouldSanitizeExcludedFields() throws Exception {
        Method method = LogAspect.class.getDeclaredMethod("argsArrayToString", Object[].class, String[].class);
        method.setAccessible(true);
        assertTrue(Modifier.isPrivate(method.getModifiers()));

        Object[] args = new Object[]{
            Map.of("name", "alice", "password", "secret", "token", "x"),
            List.of(Map.of("name", "bob", "newPassword", "hidden", "token", "y"))
        };

        String result = (String) method.invoke(logAspect, new Object[]{args, new String[]{"token"}});

        assertTrue(result.contains("alice"));
        assertTrue(result.contains("bob"));
        assertFalse(result.contains("password"));
        assertFalse(result.contains("newPassword"));
        assertFalse(result.contains("token"));
    }

    @Test
    @DisplayName("doAfterReturning: should publish success oper log with sanitized request/response")
    void doAfterReturningShouldPublishSuccessOperLog() throws Exception {
        JoinPoint joinPoint = mock(JoinPoint.class);
        Signature signature = mock(Signature.class);
        HttpServletRequest request = mock(HttpServletRequest.class);
        ApplicationContext applicationContext = mock(ApplicationContext.class);
        LoginUser loginUser = new LoginUser();
        loginUser.setUsername("tester");
        loginUser.setDeptName("研发");

        when(joinPoint.getTarget()).thenReturn(new DemoController());
        when(joinPoint.getSignature()).thenReturn(signature);
        when(signature.getName()).thenReturn("save");
        when(joinPoint.getArgs()).thenReturn(new Object[]{Map.of("name", "alice", "password", "123", "token", "t")});
        when(request.getRequestURI()).thenReturn("/system/user/save");
        when(request.getMethod()).thenReturn("POST");

        Log log = DemoController.class.getDeclaredMethod("save").getAnnotation(Log.class);

        try (MockedStatic<ServletUtils> servletUtils = mockStatic(ServletUtils.class);
             MockedStatic<LoginUserContext> loginHelper = mockStatic(LoginUserContext.class);
             MockedStatic<SpringUtils> springUtils = mockStatic(SpringUtils.class)) {
            servletUtils.when(ServletUtils::getClientIP).thenReturn("127.0.0.1");
            servletUtils.when(ServletUtils::getRequest).thenReturn(request);
            servletUtils.when(() -> ServletUtils.getParamMap(request)).thenReturn(Map.of());
            loginHelper.when(LoginUserContext::getLoginUser).thenReturn(loginUser);
            springUtils.when(SpringUtils::context).thenReturn(applicationContext);

            logAspect.doBefore(joinPoint, log);
            logAspect.doAfterReturning(joinPoint, log, Map.of("ok", true));
        }

        ArgumentCaptor<OperLogEvent> eventCaptor = ArgumentCaptor.forClass(OperLogEvent.class);
        verify(applicationContext).publishEvent(eventCaptor.capture());
        OperLogEvent event = eventCaptor.getValue();

        assertEquals("tester", event.getOperName());
        assertEquals("研发", event.getDeptName());
        assertEquals("127.0.0.1", event.getOperIp());
        assertEquals("/system/user/save", event.getOperUrl());
        assertEquals("POST", event.getRequestMethod());
        assertEquals(BusinessType.UPDATE.ordinal(), event.getBusinessType());
        assertTrue(event.getMethod().contains("DemoController.save()"));
        assertTrue(event.getOperParam().contains("alice"));
        assertFalse(event.getOperParam().contains("password"));
        assertFalse(event.getOperParam().contains("token"));
        assertTrue(event.getJsonResult().contains("\"ok\":true"));
        assertNotNull(event.getCostTime());
    }

    @Test
    @DisplayName("doAfterThrowing: should publish fail oper log and sanitize query params")
    void doAfterThrowingShouldPublishFailOperLog() throws Exception {
        JoinPoint joinPoint = mock(JoinPoint.class);
        Signature signature = mock(Signature.class);
        HttpServletRequest request = mock(HttpServletRequest.class);
        ApplicationContext applicationContext = mock(ApplicationContext.class);
        LoginUser loginUser = new LoginUser();
        loginUser.setUsername("tester");
        loginUser.setDeptName("研发");

        when(joinPoint.getTarget()).thenReturn(new DemoController());
        when(joinPoint.getSignature()).thenReturn(signature);
        when(signature.getName()).thenReturn("save");
        when(joinPoint.getArgs()).thenReturn(new Object[0]);
        when(request.getRequestURI()).thenReturn("/system/user/save");
        when(request.getMethod()).thenReturn("GET");

        Log log = DemoController.class.getDeclaredMethod("save").getAnnotation(Log.class);

        try (MockedStatic<ServletUtils> servletUtils = mockStatic(ServletUtils.class);
             MockedStatic<LoginUserContext> loginHelper = mockStatic(LoginUserContext.class);
             MockedStatic<SpringUtils> springUtils = mockStatic(SpringUtils.class)) {
            servletUtils.when(ServletUtils::getClientIP).thenReturn("127.0.0.1");
            servletUtils.when(ServletUtils::getRequest).thenReturn(request);
            servletUtils.when(() -> ServletUtils.getParamMap(request))
                .thenReturn(new HashMap<>(Map.of("id", "1", "password", "123", "token", "t")));
            loginHelper.when(LoginUserContext::getLoginUser).thenReturn(loginUser);
            springUtils.when(SpringUtils::context).thenReturn(applicationContext);

            logAspect.doBefore(joinPoint, log);
            logAspect.doAfterThrowing(joinPoint, log, new RuntimeException("boom"));
        }

        ArgumentCaptor<OperLogEvent> eventCaptor = ArgumentCaptor.forClass(OperLogEvent.class);
        verify(applicationContext).publishEvent(eventCaptor.capture());
        OperLogEvent event = eventCaptor.getValue();

        assertEquals(1, event.getStatus());
        assertTrue(event.getErrorMsg().contains("boom"));
        assertTrue(event.getOperParam().contains("\"id\":\"1\""));
        assertFalse(event.getOperParam().contains("password"));
        assertFalse(event.getOperParam().contains("token"));
    }

    private static class DemoController {

        @Log(title = "demo", businessType = BusinessType.UPDATE, isSaveRequestData = false, isSaveResponseData = false)
        public void demoMethod() {
        }

        @Log(title = "save", businessType = BusinessType.UPDATE, excludeParamNames = {"token"})
        public void save() {
        }
    }
}
