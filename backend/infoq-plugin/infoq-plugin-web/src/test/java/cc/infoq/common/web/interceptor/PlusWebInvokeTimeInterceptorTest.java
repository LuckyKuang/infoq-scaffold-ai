package cc.infoq.common.web.interceptor;

import cc.infoq.common.constant.SystemConstants;
import cc.infoq.common.utils.SpringUtils;
import cc.infoq.common.web.filter.RepeatedlyRequestWrapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.context.support.GenericApplicationContext;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.servlet.ModelAndView;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Tag("dev")
class PlusWebInvokeTimeInterceptorTest {

    @BeforeAll
    static void initSpringContext() {
        GenericApplicationContext context = new GenericApplicationContext();
        context.registerBean(ObjectMapper.class, () -> new ObjectMapper());
        context.refresh();
        new SpringUtils().setApplicationContext(context);
    }

    @Test
    @DisplayName("preHandle/afterCompletion: should support json wrapped request lifecycle")
    void preHandleAndAfterCompletionShouldSupportJsonWrappedRequest() throws Exception {
        PlusWebInvokeTimeInterceptor interceptor = new PlusWebInvokeTimeInterceptor();
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/user");
        request.setContentType("application/json");
        request.setContent("{\"name\":\"alice\",\"password\":\"secret\"}".getBytes(StandardCharsets.UTF_8));
        MockHttpServletResponse response = new MockHttpServletResponse();
        RepeatedlyRequestWrapper wrapper = new RepeatedlyRequestWrapper(request, response);

        boolean continueChain = interceptor.preHandle(wrapper, response, new Object());
        interceptor.afterCompletion(wrapper, response, new Object(), null);

        assertTrue(continueChain);
    }

    @Test
    @DisplayName("preHandle: should support parameter-map and empty-parameter branches")
    void preHandleShouldSupportParamAndEmptyParamBranches() throws Exception {
        PlusWebInvokeTimeInterceptor interceptor = new PlusWebInvokeTimeInterceptor();
        MockHttpServletResponse response = new MockHttpServletResponse();

        MockHttpServletRequest withParams = new MockHttpServletRequest("GET", "/api/users");
        withParams.setParameter("name", "alice");
        assertTrue(interceptor.preHandle(withParams, response, new Object()));
        interceptor.afterCompletion(withParams, response, new Object(), null);

        MockHttpServletRequest noParams = new MockHttpServletRequest("GET", "/api/ping");
        assertTrue(interceptor.preHandle(noParams, response, new Object()));
        interceptor.afterCompletion(noParams, response, new Object(), null);
    }

    @Test
    @DisplayName("removeSensitiveFields: should recursively remove excluded properties")
    void removeSensitiveFieldsShouldRecursivelyRemoveExcludedProperties() throws Exception {
        PlusWebInvokeTimeInterceptor interceptor = new PlusWebInvokeTimeInterceptor();
        ObjectMapper mapper = new ObjectMapper();
        JsonNode root = mapper.readTree("""
            {
              "name":"alice",
              "password":"secret",
              "profile":{"oldPassword":"x","mobile":"13800138000"},
              "list":[{"newPassword":"n1"},{"confirmPassword":"n2"}]
            }
            """);

        ReflectionTestUtils.invokeMethod(interceptor, "removeSensitiveFields", root, SystemConstants.EXCLUDE_PROPERTIES);

        assertFalse(root.has("password"));
        assertFalse(root.get("profile").has("oldPassword"));
        assertFalse(root.get("list").get(0).has("newPassword"));
        assertFalse(root.get("list").get(1).has("confirmPassword"));
    }

    @Test
    @DisplayName("afterCompletion: should be no-op when stopwatch is absent")
    void afterCompletionShouldBeNoOpWhenStopwatchAbsent() {
        PlusWebInvokeTimeInterceptor interceptor = new PlusWebInvokeTimeInterceptor();
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/health");
        MockHttpServletResponse response = new MockHttpServletResponse();

        assertDoesNotThrow(() -> interceptor.afterCompletion(request, response, new Object(), null));
    }

    @Test
    @DisplayName("postHandle: should be no-op")
    void postHandleShouldBeNoOp() {
        PlusWebInvokeTimeInterceptor interceptor = new PlusWebInvokeTimeInterceptor();
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/health");
        MockHttpServletResponse response = new MockHttpServletResponse();

        assertDoesNotThrow(() -> interceptor.postHandle(request, response, new Object(), new ModelAndView()));
    }
}
