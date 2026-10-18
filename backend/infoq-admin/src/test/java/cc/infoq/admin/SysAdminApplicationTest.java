package cc.infoq.admin;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.security.autoconfigure.UserDetailsServiceAutoConfiguration;

import java.util.Arrays;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mockStatic;

@Tag("dev")
class SysAdminApplicationTest {

    @Test
    void mainShouldDelegateToSpringApplicationRun() {
        String[] args = new String[0];
        try (MockedStatic<SpringApplication> spring = mockStatic(SpringApplication.class)) {
            spring.when(() -> SpringApplication.run(SysAdminApplication.class, args)).thenReturn(null);

            SysAdminApplication.main(args);

            spring.verify(() -> SpringApplication.run(SysAdminApplication.class, args));
        }
    }

    @Test
    void applicationShouldExcludeDefaultUserDetailsServiceAutoConfiguration() {
        SpringBootApplication annotation = SysAdminApplication.class.getAnnotation(SpringBootApplication.class);
        assertTrue(Arrays.asList(annotation.exclude()).contains(UserDetailsServiceAutoConfiguration.class));
    }
}
