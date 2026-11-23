package cc.infoq.common.web.config;

import cn.hutool.captcha.CircleCaptcha;
import cn.hutool.captcha.LineCaptcha;
import cn.hutool.captcha.ShearCaptcha;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNotSame;

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

    @Test
    @DisplayName("captcha beans: should be prototype so concurrent requests never share code/image state")
    void captchaBeansShouldBePrototypeScoped() {
        new ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(CaptchaConfig.class))
            .run(context -> {
                assertNotSame(context.getBean(CircleCaptcha.class), context.getBean(CircleCaptcha.class));
                assertNotSame(context.getBean(LineCaptcha.class), context.getBean(LineCaptcha.class));
                assertNotSame(context.getBean(ShearCaptcha.class), context.getBean(ShearCaptcha.class));
            });
    }
}
