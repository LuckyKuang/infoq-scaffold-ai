package cc.infoq.system.service.impl;

import cc.infoq.common.constant.SystemConstants;
import cc.infoq.common.domain.model.RegisterBody;
import cc.infoq.common.enums.EmailCodeScene;
import cc.infoq.common.enums.UserType;
import cc.infoq.common.exception.user.UserException;
import cc.infoq.common.log.event.LoginInfoEvent;
import cc.infoq.common.mybatis.helper.DataPermissionHelper;
import cc.infoq.common.utils.ServletUtils;
import cc.infoq.common.utils.SpringUtils;
import cc.infoq.system.domain.bo.SysUserBo;
import cc.infoq.system.domain.entity.SysPost;
import cc.infoq.system.domain.entity.SysRole;
import cc.infoq.system.mapper.SysDeptMapper;
import cc.infoq.system.mapper.SysPostMapper;
import cc.infoq.system.mapper.SysRoleMapper;
import cc.infoq.system.service.AuthEmailCodeService;
import cc.infoq.system.service.SysInviteCodeService;
import cc.infoq.system.service.SysUserService;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import jakarta.servlet.http.HttpServletRequest;
import org.apache.ibatis.builder.MapperBuilderAssistant;
import org.apache.ibatis.session.Configuration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationContext;

import java.util.function.Supplier;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@Tag("dev")
class SysRegisterServiceImplTest {

    @Mock
    private SysUserService userService;
    @Mock
    private AuthEmailCodeService authEmailCodeService;
    @Mock
    private SysInviteCodeService sysInviteCodeService;
    @Mock
    private SysRoleMapper sysRoleMapper;
    @Mock
    private SysPostMapper sysPostMapper;
    @Mock
    private SysDeptMapper sysDeptMapper;

    @BeforeEach
    void initTableInfoCache() {
        if (TableInfoHelper.getTableInfo(SysRole.class) == null) {
            TableInfoHelper.initTableInfo(new MapperBuilderAssistant(new Configuration(), ""), SysRole.class);
        }
        if (TableInfoHelper.getTableInfo(SysPost.class) == null) {
            TableInfoHelper.initTableInfo(new MapperBuilderAssistant(new Configuration(), ""), SysPost.class);
        }
    }

    @Test
    @DisplayName("register: should throw when email code mismatches")
    void registerShouldThrowWhenEmailCodeMismatches() {
        SysRegisterServiceImpl service = buildService();
        RegisterBody body = buildBody(null);
        stubDefaultRegisterLookups();
        when(authEmailCodeService.validateCode(EmailCodeScene.REGISTER, "admin@infoq.cc", "1234")).thenReturn(false);

        try (MockedStatic<DataPermissionHelper> dataPermissionHelper = mockIgnoreSupplier()) {
            assertThrows(UserException.class, () -> service.register(body));
            verifyNoInteractions(userService, sysInviteCodeService);
        }
    }

    @Test
    @DisplayName("register: should throw when username already exists")
    void registerShouldThrowWhenUserExists() {
        SysRegisterServiceImpl service = buildService();
        RegisterBody body = buildBody(null);
        stubDefaultRegisterLookups();
        when(authEmailCodeService.validateCode(EmailCodeScene.REGISTER, "admin@infoq.cc", "1234")).thenReturn(true);
        when(userService.checkUserNameUnique(any(SysUserBo.class))).thenReturn(false);

        try (MockedStatic<DataPermissionHelper> dataPermissionHelper = mockIgnoreSupplier()) {
            assertThrows(UserException.class, () -> service.register(body));
        }
    }

    @Test
    @DisplayName("register: should throw when email already exists")
    void registerShouldThrowWhenEmailExists() {
        SysRegisterServiceImpl service = buildService();
        RegisterBody body = buildBody(null);
        stubDefaultRegisterLookups();
        when(authEmailCodeService.validateCode(EmailCodeScene.REGISTER, "admin@infoq.cc", "1234")).thenReturn(true);
        when(userService.checkUserNameUnique(any(SysUserBo.class))).thenReturn(true);
        when(userService.checkEmailUnique(any(SysUserBo.class))).thenReturn(false);

        try (MockedStatic<DataPermissionHelper> dataPermissionHelper = mockIgnoreSupplier()) {
            assertThrows(UserException.class, () -> service.register(body));
        }
    }

    @Test
    @DisplayName("register: should create default owner user, consume invite code and publish success event")
    void registerShouldCreateUserAndPublishEvent() {
        SysRegisterServiceImpl service = buildService();
        RegisterBody body = buildBody("INVITE-CODE");
        stubDefaultRegisterLookups();
        ApplicationContext context = mock(ApplicationContext.class);
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(authEmailCodeService.validateCode(EmailCodeScene.REGISTER, "admin@infoq.cc", "1234")).thenReturn(true);
        when(userService.checkUserNameUnique(any(SysUserBo.class))).thenReturn(true);
        when(userService.checkEmailUnique(any(SysUserBo.class))).thenReturn(true);
        when(userService.registerUser(any(SysUserBo.class))).thenAnswer(invocation -> {
            SysUserBo user = invocation.getArgument(0);
            user.setUserId(99L);
            return true;
        });

        try (MockedStatic<DataPermissionHelper> dataPermissionHelper = mockIgnoreSupplier();
             MockedStatic<SpringUtils> springUtils = mockStatic(SpringUtils.class);
             MockedStatic<ServletUtils> servletUtils = mockStatic(ServletUtils.class)) {
            springUtils.when(SpringUtils::context).thenReturn(context);
            servletUtils.when(ServletUtils::getRequest).thenReturn(request);

            service.register(body);

            ArgumentCaptor<SysUserBo> userCaptor = ArgumentCaptor.forClass(SysUserBo.class);
            verify(userService).registerUser(userCaptor.capture());
            SysUserBo savedUser = userCaptor.getValue();
            assertEquals("admin", savedUser.getUserName());
            assertEquals("admin", savedUser.getNickName());
            assertEquals("admin@infoq.cc", savedUser.getEmail());
            assertEquals(UserType.SYS_USER.getUserType(), savedUser.getUserType());
            assertEquals(SystemConstants.REGISTER_DEFAULT_DEPT_ID, savedUser.getDeptId());
            assertEquals(SystemConstants.REGISTER_DEFAULT_DEPT_ID, savedUser.getCreateDept());
            assertEquals(SystemConstants.NORMAL, savedUser.getStatus());
            assertArrayEquals(new Long[]{4L}, savedUser.getRoleIds());
            assertArrayEquals(new Long[]{4L}, savedUser.getPostIds());
            verify(sysInviteCodeService).validateInviteCodeAvailable("INVITE-CODE");
            verify(sysInviteCodeService).consumeInviteCode("INVITE-CODE", 99L);

            ArgumentCaptor<LoginInfoEvent> eventCaptor = ArgumentCaptor.forClass(LoginInfoEvent.class);
            verify(context).publishEvent(eventCaptor.capture());
            assertEquals("admin", eventCaptor.getValue().getUsername());
        }
    }

    private SysRegisterServiceImpl buildService() {
        return new SysRegisterServiceImpl(userService, authEmailCodeService, sysInviteCodeService, sysRoleMapper, sysPostMapper, sysDeptMapper);
    }

    private void stubDefaultRegisterLookups() {
        SysRole role = new SysRole();
        role.setRoleId(4L);
        when(sysRoleMapper.selectOne(any())).thenReturn(role);

        SysPost post = new SysPost();
        post.setPostId(4L);
        when(sysPostMapper.selectOne(any())).thenReturn(post);

        when(sysDeptMapper.countDeptById(SystemConstants.REGISTER_DEFAULT_DEPT_ID)).thenReturn(1L);
    }

    @SuppressWarnings("unchecked")
    private MockedStatic<DataPermissionHelper> mockIgnoreSupplier() {
        MockedStatic<DataPermissionHelper> helper = mockStatic(DataPermissionHelper.class);
        helper.when(() -> DataPermissionHelper.ignore(org.mockito.ArgumentMatchers.<Supplier<Object>>any()))
            .thenAnswer(invocation -> ((Supplier<Object>) invocation.getArgument(0)).get());
        return helper;
    }

    private RegisterBody buildBody(String inviteCode) {
        RegisterBody body = new RegisterBody();
        body.setUsername("admin");
        body.setPassword("Admin@123");
        body.setEmail("admin@infoq.cc");
        body.setEmailCode("1234");
        body.setInviteCode(inviteCode);
        return body;
    }
}
