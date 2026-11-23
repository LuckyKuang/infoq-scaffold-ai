package cc.infoq.system.controller;

import cc.infoq.common.security.handler.SecurityAccessDeniedHandler;
import cc.infoq.common.security.handler.SecurityAuthenticationEntryPoint;
import cc.infoq.common.security.handler.SecurityExceptionAdvice;
import cc.infoq.common.web.handler.GlobalExceptionHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.authorization.AuthorizationDecision;
import org.springframework.security.authorization.AuthorizationDeniedException;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.ObjectMapper;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Tag("dev")
class SecurityExceptionAdviceOrderTest {

    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        ObjectMapper objectMapper = new ObjectMapper();
        SecurityExceptionAdvice securityAdvice = new SecurityExceptionAdvice(
            new SecurityAuthenticationEntryPoint(objectMapper, null),
            new SecurityAccessDeniedHandler(objectMapper));
        // 全局处理器先注册，验证的是 @Order 优先级而非注册顺序
        mvc = MockMvcBuilders.standaloneSetup(new GuardedController())
            .setControllerAdvice(new GlobalExceptionHandler(), securityAdvice)
            .build();
    }

    @Test
    @DisplayName("方法级鉴权拒绝返回 HTTP 403，而不是被全局 RuntimeException 处理器吞成 200/500")
    void methodSecurityDenialReturnsForbidden() throws Exception {
        mvc.perform(get("/guarded/denied"))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value(403))
            .andExpect(jsonPath("$.msg").value("没有访问权限，请联系管理员授权"));
    }

    @Test
    @DisplayName("MVC 内缺少认证返回 HTTP 401")
    void missingAuthenticationInsideMvcReturnsUnauthorized() throws Exception {
        mvc.perform(get("/guarded/anonymous"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value(401))
            .andExpect(jsonPath("$.msg").value("认证失败，无法访问系统资源"));
    }

    @Test
    @DisplayName("非安全运行时异常仍由全局处理器处理")
    void otherRuntimeExceptionsStillUseGlobalHandler() throws Exception {
        mvc.perform(get("/guarded/boom"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(500))
            .andExpect(jsonPath("$.msg").value("boom"));
    }

    @RestController
    static class GuardedController {

        @GetMapping("/guarded/denied")
        String denied() {
            throw new AuthorizationDeniedException("Access Denied", new AuthorizationDecision(false));
        }

        @GetMapping("/guarded/anonymous")
        String anonymous() {
            throw new AuthenticationCredentialsNotFoundException("Current security authentication is required");
        }

        @GetMapping("/guarded/boom")
        String boom() {
            throw new IllegalStateException("boom");
        }
    }
}
