package cc.infoq.common.redis.aspectj;

import cc.infoq.common.constant.GlobalConstants;
import cc.infoq.common.domain.ApiResult;
import cc.infoq.common.exception.ServiceException;
import cc.infoq.common.json.utils.JsonUtils;
import cc.infoq.common.redis.annotation.RepeatSubmit;
import cc.infoq.common.redis.utils.RedisUtils;
import cc.infoq.common.utils.MessageUtils;
import cc.infoq.common.utils.ServletUtils;
import cc.infoq.common.utils.StringUtils;
import cn.hutool.core.util.ArrayUtil;
import cn.hutool.core.util.ObjectUtil;
import cn.hutool.crypto.SecureUtil;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.annotation.AfterReturning;
import org.aspectj.lang.annotation.AfterThrowing;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Before;
import org.springframework.http.HttpHeaders;
import org.springframework.validation.BindingResult;
import org.springframework.web.multipart.MultipartFile;

import java.time.Duration;
import java.util.Collection;
import java.util.Map;
import java.util.StringJoiner;

/**
 * 防止重复提交(参考美团GTIS防重系统)
 *
 * @author Pontus
 */
@Aspect
public class RepeatSubmitAspect {

    private static final ThreadLocal<String> KEY_CACHE = new ThreadLocal<>();

    private static final String TOKEN_NAME = HttpHeaders.AUTHORIZATION;

    private static final String CLIENT_ID_NAME = "clientid";

    @Before("@annotation(repeatSubmit)")
    public void doBefore(JoinPoint point, RepeatSubmit repeatSubmit) throws Throwable {
        // 如果注解不为0 则使用注解数值
        long interval = repeatSubmit.timeUnit().toMillis(repeatSubmit.interval());

        if (interval < 1000) {
            throw new ServiceException("重复提交间隔时间不能小于'1'秒");
        }
        HttpServletRequest request = ServletUtils.getRequest();
        String nowParams = argsArrayToString(point.getArgs());

        // 请求地址（作为存放cache的key值）
        String url = request.getRequestURI();

        // 唯一值：优先使用新认证契约中的 token；公开请求使用客户端/来源指纹，避免匿名请求全局互锁。
        String submitKey = SecureUtil.md5(resolveSubmitIdentity(request) + ":" + nowParams);
        // 唯一标识（指定key + url + 消息头）
        String cacheRepeatKey = GlobalConstants.REPEAT_SUBMIT_KEY + url + submitKey;
        if (RedisUtils.setObjectIfAbsent(cacheRepeatKey, "", Duration.ofMillis(interval))) {
            KEY_CACHE.set(cacheRepeatKey);
        } else {
            String message = repeatSubmit.message();
            if (StringUtils.startsWith(message, "{") && StringUtils.endsWith(message, "}")) {
                message = MessageUtils.message(StringUtils.substring(message, 1, message.length() - 1));
            }
            throw new ServiceException(message);
        }
    }

    /**
     * 处理完请求后执行
     *
     * @param joinPoint 切点
     */
    @AfterReturning(pointcut = "@annotation(repeatSubmit)", returning = "jsonResult")
    public void doAfterReturning(JoinPoint joinPoint, RepeatSubmit repeatSubmit, Object jsonResult) {
        if (jsonResult instanceof ApiResult<?> apiResult) {
            try {
                // 成功则不删除redis数据 保证在有效时间内无法重复提交
                if (apiResult.getCode() == ApiResult.SUCCESS) {
                    return;
                }
                RedisUtils.deleteObject(KEY_CACHE.get());
            } finally {
                KEY_CACHE.remove();
            }
        }
    }

    /**
     * 拦截异常操作
     *
     * @param joinPoint 切点
     * @param e         异常
     */
    @AfterThrowing(value = "@annotation(repeatSubmit)", throwing = "e")
    public void doAfterThrowing(JoinPoint joinPoint, RepeatSubmit repeatSubmit, Exception e) {
        RedisUtils.deleteObject(KEY_CACHE.get());
        KEY_CACHE.remove();
    }

    /**
     * 参数拼装
     */
    private String argsArrayToString(Object[] paramsArray) {
        StringJoiner params = new StringJoiner(" ");
        if (ArrayUtil.isEmpty(paramsArray)) {
            return params.toString();
        }
        for (Object o : paramsArray) {
            if (ObjectUtil.isNotNull(o) && !isFilterObject(o)) {
                params.add(JsonUtils.toJsonString(o));
            }
        }
        return params.toString();
    }

    private String resolveSubmitIdentity(HttpServletRequest request) {
        String token = firstNonBlank(request.getHeader(TOKEN_NAME), request.getParameter(TOKEN_NAME));
        if (StringUtils.isNotBlank(token)) {
            return "token:" + SecureUtil.md5(normalizeBearerToken(token));
        }
        String clientId = firstNonBlank(request.getHeader(CLIENT_ID_NAME), request.getParameter(CLIENT_ID_NAME));
        String clientIp = firstNonBlank(ServletUtils.getClientIP(), request.getRemoteAddr());
        String userAgent = StringUtils.trimToEmpty(request.getHeader(HttpHeaders.USER_AGENT));
        return "anonymous:" + StringUtils.trimToEmpty(clientId) + ":" + StringUtils.trimToEmpty(clientIp) + ":" + userAgent;
    }

    private String normalizeBearerToken(String token) {
        String value = token.trim();
        String prefix = "Bearer ";
        if (StringUtils.startsWithIgnoreCase(value, prefix)) {
            return value.substring(prefix.length()).trim();
        }
        return value;
    }

    private String firstNonBlank(String first, String second) {
        if (StringUtils.isNotBlank(first)) {
            return first.trim();
        }
        if (StringUtils.isNotBlank(second)) {
            return second.trim();
        }
        return StringUtils.EMPTY;
    }

    /**
     * 判断是否需要过滤的对象。
     *
     * @param o 对象信息。
     * @return 如果是需要过滤的对象，则返回true；否则返回false。
     */
    public boolean isFilterObject(final Object o) {
        Class<?> clazz = o.getClass();
        if (clazz.isArray()) {
            return MultipartFile.class.isAssignableFrom(clazz.getComponentType());
        } else if (Collection.class.isAssignableFrom(clazz)) {
            Collection<?> collection = (Collection<?>) o;
            for (Object value : collection) {
                return value instanceof MultipartFile;
            }
        } else if (Map.class.isAssignableFrom(clazz)) {
            Map<?, ?> map = (Map<?, ?>) o;
            for (Object value : map.values()) {
                return value instanceof MultipartFile;
            }
        }
        return o instanceof MultipartFile || o instanceof HttpServletRequest || o instanceof HttpServletResponse
               || o instanceof BindingResult;
    }

}
