package cc.infoq.system.support.plugin;

import cc.infoq.common.exception.ServiceException;
import cc.infoq.common.utils.SpringUtils;
import lombok.AccessLevel;
import lombok.NoArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import java.io.File;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;

/**
 * 邮件插件可选调用工具.
 */
@Slf4j
@NoArgsConstructor(access = AccessLevel.PRIVATE)
public class OptionalMailHelper {

    private static final String MAIL_UTILS_CLASS = "cc.infoq.common.mail.utils.MailUtils";

    /**
     * 邮件功能是否开启.
     */
    public static boolean isEnabled() {
        return Boolean.parseBoolean(SpringUtils.getProperty("mail.enabled", "false"));
    }

    /**
     * 发送文本邮件.
     */
    public static void sendText(String to, String subject, String content) {
        try {
            Class<?> clazz = Class.forName(MAIL_UTILS_CLASS);
            Method method = clazz.getMethod("sendText", String.class, String.class, String.class, File[].class);
            method.invoke(null, to, subject, content, new File[0]);
        } catch (ClassNotFoundException e) {
            throw new ServiceException("未引入邮件插件，无法发送邮件验证码");
        } catch (InvocationTargetException e) {
            Throwable target = e.getTargetException();
            throw new ServiceException(target == null ? e.getMessage() : target.getMessage());
        } catch (LinkageError e) {
            log.error("发送邮件初始化异常", e);
            throw new ServiceException(e.getMessage());
        } catch (Exception e) {
            log.error("发送邮件异常", e);
            throw new ServiceException(e.getMessage());
        }
    }
}
