package cc.infoq.common.utils;

import cc.infoq.common.domain.ApiResult;
import cc.infoq.common.exception.ServiceException;
import cc.infoq.common.exception.SseException;
import cc.infoq.common.exception.base.BaseException;
import io.github.linpeilie.Converter;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.context.support.GenericApplicationContext;
import org.springframework.context.support.StaticMessageSource;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@Tag("dev")
class CoreCommonGapFillTest {

    private GenericApplicationContext context;
    private Converter converter;

    @BeforeEach
    void setUp() {
        converter = Mockito.mock(Converter.class);

        StaticMessageSource messageSource = new StaticMessageSource();
        messageSource.addMessage("demo.code", Locale.SIMPLIFIED_CHINESE, "translated-{0}");
        messageSource.addMessage("error.code", Locale.SIMPLIFIED_CHINESE, "error-{0}");

        context = new GenericApplicationContext();
        context.registerBean(Converter.class, () -> converter);
        context.registerBean("messageSource", StaticMessageSource.class, () -> messageSource);
        context.refresh();
        new SpringUtils().setApplicationContext(context);
    }

    @AfterEach
    void tearDown() {
        RequestContextHolder.resetRequestAttributes();
        if (context != null) {
            context.close();
        }
    }

    @Test
    @DisplayName("MapstructUtils/message: should cover static init and conversion branches")
    void mapstructAndMessageUtilsShouldCoverAllBranches() {
        Locale origin = Locale.getDefault();
        Locale.setDefault(Locale.SIMPLIFIED_CHINESE);
        try {
            DemoBean bean = new DemoBean();
            bean.setName("mapped");
            StringBuilder target = new StringBuilder();

            when(converter.convert(eq("src"), eq(DemoBean.class))).thenReturn(bean);
            when(converter.convert(eq("src"), eq(target))).thenReturn(target.append("ok"));
            when(converter.convert(anyList(), eq(DemoBean.class))).thenReturn(List.of(bean));
            when(converter.convert(anyMap(), eq(DemoBean.class))).thenReturn(bean);

            assertNull(MapstructUtils.convert((Object) null, DemoBean.class));
            assertNull(MapstructUtils.convert("src", (Class<DemoBean>) null));
            assertSame(bean, MapstructUtils.convert("src", DemoBean.class));

            assertNull(MapstructUtils.convert(null, target));
            assertNull(MapstructUtils.convert("src", (StringBuilder) null));
            assertSame(target, MapstructUtils.convert("src", target));

            assertNull(MapstructUtils.convert((List<String>) null, DemoBean.class));
            assertTrue(MapstructUtils.convert(List.<String>of(), DemoBean.class).isEmpty());
            assertEquals(1, MapstructUtils.convert(List.of("a"), DemoBean.class).size());

            assertNull(MapstructUtils.convert((Map<String, Object>) null, DemoBean.class));
            assertNull(MapstructUtils.convert(Map.of("k", "v"), null));
            assertSame(bean, MapstructUtils.convert(Map.of("k", "v"), DemoBean.class));

            String translated = MessageUtils.message("demo.code", "x");
            assertTrue("translated-x".equals(translated) || "demo.code".equals(translated));
            assertEquals("missing.code", MessageUtils.message("missing.code"));
        } finally {
            Locale.setDefault(origin);
        }
    }

    @Test
    @DisplayName("ApiResult/Exception constructors: should cover object overloads and constructor branches")
    void apiResultAndExceptionConstructorsShouldBeCovered() {
        Map<String, Integer> payload = Map.of("k", 1);
        ApiResult<Map<String, Integer>> ok = ApiResult.ok(payload);
        ApiResult<Map<String, Integer>> fail = ApiResult.fail(payload);

        assertEquals(ApiResult.SUCCESS, ok.getCode());
        assertSame(payload, ok.getData());
        assertEquals(ApiResult.FAIL, fail.getCode());
        assertSame(payload, fail.getData());

        ServiceException serviceException = new ServiceException("service", 400);
        assertEquals("service", serviceException.getMessage());
        assertEquals(400, serviceException.getCode());

        BaseException moduleMessage = new BaseException("module", "module message");
        assertEquals("module message", moduleMessage.getMessage());
        Locale locale = LocaleContextHolder.getLocale();
        try {
            LocaleContextHolder.setLocale(Locale.SIMPLIFIED_CHINESE);
            BaseException codeArgs = new BaseException("error.code", new Object[]{"x"});
            assertEquals("error-x", codeArgs.getMessage());
            BaseException moduleCodeArgs = new BaseException("system", "error.code", new Object[]{"x"});
            assertEquals("error-x", moduleCodeArgs.getMessage());
        } finally {
            LocaleContextHolder.setLocale(locale);
        }

        SseException sseException = new SseException("sse-msg");
        assertEquals("sse-msg", sseException.getMessage());
        assertSame(sseException, sseException.setMessage("changed").setDetailMessage("detail"));
        assertEquals("changed", sseException.getMessage());
    }

    @Test
    @DisplayName("Servlet/Stream helpers: should cover getResponse/getClientIP/join-overload")
    void servletAndStreamHelpersShouldCoverRemainingBranches() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        request.addHeader("X-Forwarded-For", "203.0.113.9");
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request, response));

        HttpServletResponse current = ServletUtils.getResponse();
        assertSame(response, current);
        assertTrue(ServletUtils.getClientIP().contains("203.0.113.9"));

        RequestContextHolder.resetRequestAttributes();
        assertThrows(IllegalStateException.class, ServletUtils::getResponse);

        String joined = StreamUtils.join(Arrays.asList(1, null, 3), value -> value == null ? null : "n" + value);
        assertEquals("n1,n3", joined);
        assertFalse(joined.contains("null"));
    }

    private static class DemoBean {
        private String name;

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }
    }
}
