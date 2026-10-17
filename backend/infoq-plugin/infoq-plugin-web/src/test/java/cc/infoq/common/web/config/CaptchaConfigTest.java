package cc.infoq.common.web.config;

import cn.hutool.captcha.CircleCaptcha;
import cn.hutool.captcha.LineCaptcha;
import cn.hutool.captcha.ShearCaptcha;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertNotNull;

@Tag("dev")
class CaptchaConfigTest {

    @Test
    @DisplayName("captcha beans: should create and render captcha instances")
    void captchaBeansShouldCreateAndRenderCaptchaInstances() {
        CaptchaConfig config = new CaptchaConfig();

        CircleCaptcha circle = config.circleCaptcha();
        LineCaptcha line = config.lineCaptcha();
        ShearCaptcha shear = config.shearCaptcha();

        assertNotNull(circle);
        assertNotNull(line);
        assertNotNull(shear);
        assertNotNull(circle.getImage());
        assertNotNull(line.getImage());
        assertNotNull(shear.getImage());
    }
}
