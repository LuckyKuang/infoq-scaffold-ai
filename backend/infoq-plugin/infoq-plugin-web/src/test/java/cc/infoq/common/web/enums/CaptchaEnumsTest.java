package cc.infoq.common.web.enums;

import cn.hutool.captcha.CircleCaptcha;
import cn.hutool.captcha.LineCaptcha;
import cn.hutool.captcha.ShearCaptcha;
import cn.hutool.captcha.generator.MathGenerator;
import cn.hutool.captcha.generator.RandomGenerator;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

@Tag("dev")
class CaptchaEnumsTest {

    @Test
    @DisplayName("captcha enums: should expose expected class mapping")
    void captchaEnumsShouldExposeExpectedClassMapping() {
        assertEquals(LineCaptcha.class, CaptchaCategory.LINE.getClazz());
        assertEquals(CircleCaptcha.class, CaptchaCategory.CIRCLE.getClazz());
        assertEquals(ShearCaptcha.class, CaptchaCategory.SHEAR.getClazz());

        assertEquals(MathGenerator.class, CaptchaType.MATH.getClazz());
        assertEquals(RandomGenerator.class, CaptchaType.CHAR.getClazz());
    }
}
