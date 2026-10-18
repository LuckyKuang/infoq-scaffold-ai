package cc.infoq.admin;

import cc.infoq.common.push.service.DefaultPushService;
import cc.infoq.common.security.browser.BrowserSessionGuardFilter;
import cc.infoq.common.security.handler.SecurityAccessDeniedHandler;
import cc.infoq.common.security.handler.SecurityAuthenticationEntryPoint;
import cc.infoq.common.web.config.ResourcesConfig;
import cc.infoq.system.controller.login.BrowserSessionController;
import cc.infoq.system.listener.SysMessagePushListener;
import cc.infoq.system.service.impl.SysUserServiceImpl;
import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.LoggerContext;
import ch.qos.logback.classic.util.ContextInitializer;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.bootstrap.DefaultBootstrapContext;
import org.springframework.boot.context.event.ApplicationEnvironmentPreparedEvent;
import org.springframework.boot.context.event.ApplicationStartingEvent;
import org.springframework.boot.context.logging.LoggingApplicationListener;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.boot.logging.LoggingSystem;
import org.springframework.core.env.MapPropertySource;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.core.io.ClassPathResource;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.HashMap;

import static org.junit.jupiter.api.Assertions.*;

@Tag("prod")
class ProductionObservabilityLoggingTest {
    @Test
    void productionLoggingRetainsSecurityAndPushInfoWithoutEnablingOtherBusinessInfo() throws Exception {
        var environment = new StandardEnvironment();
        var loader = new YamlPropertySourceLoader();
        for (String resource : List.of("application.yml", "application-prod.yml")) {
            for (var source : loader.load(resource, new ClassPathResource(resource))) {
                environment.getPropertySources().addFirst(source);
            }
        }
        assertEquals("prod", environment.getProperty("spring.profiles.active"), "run with -Pprod to verify actual Maven-filtered production resources");
        assertEquals("warn", environment.getProperty("logging.level.cc.infoq"));
        environment.setActiveProfiles("prod");
        environment.getPropertySources().addFirst(new MapPropertySource("logging-test", Map.of(
            "logging.register-shutdown-hook", "false")));

        Path repository = Path.of(System.getProperty("user.dir")).toAbsolutePath();
        while (!Files.isRegularFile(repository.resolve("tools/validate_utf8.mjs"))) {
            repository = repository.getParent();
            assertNotNull(repository, "repository root must be available");
        }
        Path temporaryRoot = Files.createDirectories(repository.resolve("tmp"));
        Path logs = Files.createTempDirectory(temporaryRoot, "production-logging-");
        String previousLogPath = System.getProperty("INFOQ_LOG_PATH");
        System.setProperty("INFOQ_LOG_PATH", logs.toString());
        var events = new ListAppender<ILoggingEvent>();
        var context = (LoggerContext) LoggerFactory.getILoggerFactory();
        Map<String, Level> previousLevels = new HashMap<>();
        context.getLoggerList().forEach(logger -> previousLevels.put(logger.getName(), logger.getLevel()));
        try {
            var application = new SpringApplication(ProductionObservabilityLoggingTest.class);
            var bootstrap = new DefaultBootstrapContext();
            var listener = new LoggingApplicationListener();
            listener.onApplicationEvent(new ApplicationStartingEvent(bootstrap, application, new String[0]));
            listener.onApplicationEvent(new ApplicationEnvironmentPreparedEvent(bootstrap, application, new String[0], environment));
            events.setContext(context);
            events.start();
            context.getLogger(Logger.ROOT_LOGGER_NAME).addAppender(events);
            assertEquals(Level.WARN, context.getLogger("cc.infoq").getLevel());
            List<Class<?>> observed = List.of(BrowserSessionController.class, BrowserSessionGuardFilter.class,
                SecurityAccessDeniedHandler.class, SecurityAuthenticationEntryPoint.class, ResourcesConfig.class,
                DefaultPushService.class, SysMessagePushListener.class);
            for (Class<?> type : observed) {
                Logger logger = context.getLogger(type);
                assertTrue(logger.isInfoEnabled(), type.getName() + " production audit INFO is disabled");
                assertFalse(logger.isDebugEnabled(), type.getName() + " must not enable DEBUG");
                logger.info("production_observability_probe category=isolated_test");
            }
            Logger unrelated = context.getLogger(SysUserServiceImpl.class);
            assertEquals(Level.WARN, unrelated.getEffectiveLevel());
            unrelated.info("unrelated_business_info_must_remain_disabled");
            assertEquals(observed.stream().map(Class::getName).toList(), events.list.stream()
                .map(ILoggingEvent::getLoggerName).toList());
            assertEquals(7, Files.readString(logs.resolve("sys-console.log")).lines()
                .filter(line -> line.contains("production_observability_probe")).count());
            context.stop();
            assertEquals(7, Files.readString(logs.resolve("sys-info.log")).lines()
                .filter(line -> line.contains("production_observability_probe")).count(),
                "production async INFO output must flush when logging shuts down");
        } finally {
            context.getLogger(Logger.ROOT_LOGGER_NAME).detachAppender(events);
            events.stop();
            LoggingSystem.get(getClass().getClassLoader()).cleanUp();
            context.stop();
            context.reset();
            if (previousLogPath == null) {
                System.clearProperty("INFOQ_LOG_PATH");
            } else {
                System.setProperty("INFOQ_LOG_PATH", previousLogPath);
            }
            context.start();
            new ContextInitializer(context).autoConfig();
            context.getLoggerList().forEach(logger -> logger.setLevel(previousLevels.get(logger.getName())));
        }
    }
}
