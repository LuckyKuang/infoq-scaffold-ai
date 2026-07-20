package cc.infoq.common.utils;

import cc.infoq.common.config.ApplicationConfig;
import cc.infoq.common.constant.Constants;
import cc.infoq.common.constant.SystemConstants;
import cc.infoq.common.domain.ApiResult;
import cc.infoq.common.domain.model.LoginUser;
import cc.infoq.common.enums.DeviceType;
import cc.infoq.common.enums.LoginType;
import cc.infoq.common.enums.UserStatus;
import cc.infoq.common.exception.ServiceException;
import cc.infoq.common.exception.SseException;
import cc.infoq.common.exception.base.BaseException;
import cc.infoq.common.exception.file.FileNameLengthLimitExceededException;
import cc.infoq.common.exception.file.FileSizeLimitExceededException;
import cc.infoq.common.exception.user.CaptchaException;
import cc.infoq.common.exception.user.CaptchaExpireException;
import cc.infoq.common.exception.user.UserException;
import cc.infoq.common.factory.RegexPatternPoolFactory;
import cc.infoq.common.service.ConfigService;
import cc.infoq.common.service.DictService;
import cc.infoq.common.utils.file.MimeTypeUtils;
import cc.infoq.common.utils.ip.AddressUtils;
import cc.infoq.common.utils.regex.RegexUtils;
import cc.infoq.common.utils.regex.RegexValidator;
import cc.infoq.common.xss.XssValidator;
import cn.hutool.core.exceptions.ValidateException;
import cn.hutool.core.lang.Dict;
import jakarta.validation.ConstraintViolationException;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.constraints.NotBlank;
import org.junit.jupiter.api.*;
import org.springframework.context.support.GenericApplicationContext;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@Tag("dev")
class CoreCommonCoverageBackfillTest {

    private GenericApplicationContext context;

    @BeforeEach
    void setUpContext() {
        context = new GenericApplicationContext();
        context.registerBean("sampleBean", String.class, () -> "sample");
        context.registerBean(Validator.class, () -> Validation.buildDefaultValidatorFactory().getValidator());
        context.refresh();
        context.getBeanFactory().registerAlias("sampleBean", "sampleAlias");
        new SpringUtils().setApplicationContext(context);
    }

    @AfterEach
    void tearDownContext() {
        if (context != null) {
            context.close();
        }
    }

    @Test
    @DisplayName("ApiResult/exceptions: should cover response and exception helper branches")
    void apiResultAndExceptionsShouldWork() {
        ApiResult<Void> ok0 = ApiResult.ok();
        ApiResult<String> ok1 = ApiResult.ok("payload");
        ApiResult<Void> ok2 = ApiResult.ok("done");
        ApiResult<String> ok3 = ApiResult.ok("done", "v");
        ApiResult<Void> fail0 = ApiResult.fail();
        ApiResult<Void> fail1 = ApiResult.fail("bad");
        ApiResult<String> fail2 = ApiResult.fail("x");
        ApiResult<String> fail3 = ApiResult.fail("bad", "v");
        ApiResult<Void> fail4 = ApiResult.fail(403, "forbidden");
        ApiResult<Void> warn = ApiResult.warn("warn");
        ApiResult<String> warnWithData = ApiResult.warn("warn", "v");

        assertTrue(ApiResult.isSuccess(ok0));
        assertFalse(ApiResult.isSuccess(fail0));
        assertTrue(ApiResult.isError(fail0));
        assertEquals(ApiResult.SUCCESS, ok1.getCode());
        assertEquals("payload", ok1.getMsg());
        assertEquals("done", ok2.getMsg());
        assertEquals("v", ok3.getData());
        assertEquals(ApiResult.FAIL, fail1.getCode());
        assertEquals("x", fail2.getMsg());
        assertEquals("bad", fail3.getMsg());
        assertEquals(403, fail4.getCode());
        assertEquals("warn", warn.getMsg());
        assertEquals("v", warnWithData.getData());

        BaseException withDefault = new BaseException("default-msg");
        assertEquals("default-msg", withDefault.getMessage());

        ServiceException serviceException = new ServiceException("error {}", "x");
        assertEquals("error x", serviceException.getMessage());
        assertSame(serviceException, serviceException.setMessage("m").setDetailMessage("d"));
        assertEquals("m", serviceException.getMessage());

        SseException sseException = new SseException("sse", 500);
        assertSame(sseException, sseException.setMessage("changed").setDetailMessage("detail"));
        assertEquals("changed", sseException.getMessage());

        assertNotNull(new FileNameLengthLimitExceededException(20));
        assertNotNull(new FileSizeLimitExceededException(1024L));
        assertNotNull(new UserException("user.not.exists", "tom"));
        assertNotNull(new CaptchaException());
        assertNotNull(new CaptchaExpireException());
    }

    @Test
    @DisplayName("enum/constants/spring/object defaults: should cover utility branches")
    void enumConstantsSpringAndObjectShouldWork() {
        assertEquals("pc", DeviceType.PC.getDevice());
        assertEquals("miniapp", DeviceType.MINIAPP.getDevice());
        assertEquals("0", UserStatus.OK.getCode());
        assertEquals("user.password.retry.limit.exceed", LoginType.PASSWORD.getRetryLimitExceed());
        assertEquals("0", Constants.SUCCESS);
        assertEquals(2, Constants.CAPTCHA_EXPIRATION);
        assertTrue(SystemConstants.EXCLUDE_PROPERTIES.length > 0);

        LoginUser loginUser = new LoginUser();
        loginUser.setUserType("sys_user");
        loginUser.setUserId(8L);
        assertEquals("sys_user:8", loginUser.getLoginId());
        LoginUser invalid = new LoginUser();
        invalid.setUserId(8L);
        assertThrows(IllegalArgumentException.class, invalid::getLoginId);

        assertEquals("sample", ObjectUtils.notNullGetter("sample", value -> value));
        assertNull(ObjectUtils.notNullGetter(null, value -> value));
        assertEquals("fallback", ObjectUtils.notNullGetter(null, value -> value, "fallback"));
        assertEquals("x", ObjectUtils.notNull("x", "y"));
        assertEquals("y", ObjectUtils.notNull(null, "y"));

        assertTrue(SpringUtils.containsBean("sampleBean"));
        assertTrue(SpringUtils.isSingleton("sampleBean"));
        assertEquals(String.class, SpringUtils.getType("sampleBean"));
        assertTrue(Arrays.asList(SpringUtils.getAliases("sampleBean")).contains("sampleAlias"));
        assertSame(context, SpringUtils.context());
        assertEquals("sample", SpringUtils.getAopProxy("x"));
        assertFalse(SpringUtils.isVirtual());

        new ApplicationConfig();
        new MimeTypeUtils();
        new RegexPatternPoolFactory();
        new RegexUtils();
        new RegexValidator();
    }

    @Test
    @DisplayName("service defaults/regex/xss/validator/address: should cover default methods and validators")
    void serviceDefaultsAndRegexShouldWork() {
        ConfigService configService = new ConfigService() {
            @Override
            public String getConfigValue(String configKey) {
                return switch (configKey) {
                    case "bool" -> "true";
                    case "int" -> "7";
                    case "long" -> "9";
                    case "decimal" -> "1.23";
                    default -> "";
                };
            }

            @Override
            public Dict getConfigMap(String configKey) {
                return Dict.create().set("k", "v");
            }

            @Override
            public List<Dict> getConfigArrayMap(String configKey) {
                return List.of(Dict.create().set("k", "v"));
            }

            @Override
            public <T> T getConfigObject(String configKey, Class<T> clazz) {
                return null;
            }

            @Override
            public <T> List<T> getConfigArray(String configKey, Class<T> clazz) {
                return List.of();
            }
        };
        assertTrue(configService.getConfigBool("bool"));
        assertEquals(7, configService.getConfigInt("int"));
        assertEquals(9L, configService.getConfigLong("long"));
        assertEquals(new BigDecimal("1.23"), configService.getConfigDecimal("decimal"));

        DictService dictService = new DictService() {
            @Override
            public String getDictLabel(String dictType, String dictValue, String separator) {
                return dictType + separator + dictValue;
            }

            @Override
            public String getDictValue(String dictType, String dictLabel, String separator) {
                return dictType + separator + dictLabel;
            }

            @Override
            public Map<String, String> getAllDictByDictType(String dictType) {
                return Map.of();
            }

            @Override
            public cc.infoq.common.domain.dto.DictTypeDTO getDictType(String dictType) {
                return null;
            }

            @Override
            public List<cc.infoq.common.domain.dto.DictDataDTO> getDictData(String dictType) {
                return List.of();
            }
        };
        assertEquals("type,1", dictService.getDictLabel("type", "1"));
        assertEquals("type,A", dictService.getDictValue("type", "A"));

        assertEquals("abc", RegexUtils.extractFromString("x-abc-y", "x-(\\w+)-y", "default"));
        assertEquals("default", RegexUtils.extractFromString("x-abc-y", "(", "default"));
        assertTrue(RegexValidator.isAccount("admin_1"));
        assertThrows(ValidateException.class, () -> RegexValidator.validateAccount("bad account", "invalid"));
        assertTrue(RegexValidator.isStatus("0"));
        assertThrows(ValidateException.class, () -> RegexValidator.validateStatus("9", "invalid"));

        XssValidator xssValidator = new XssValidator();
        assertTrue(xssValidator.isValid("plain text", null));
        assertFalse(xssValidator.isValid("<script>alert(1)</script>", null));
        assertEquals(AddressUtils.UNKNOWN_IP, AddressUtils.getRealAddressByIP("<b>bad-ip</b>"));

        SimpleBean bean = new SimpleBean();
        bean.name = "ok";
        ValidatorUtils.validate(bean);
        bean.name = "";
        assertThrows(ConstraintViolationException.class, () -> ValidatorUtils.validate(bean));
    }

    private static final class SimpleBean {
        @NotBlank
        private String name;
    }
}
