package cc.infoq.system.service.impl;

import cc.infoq.common.domain.dto.RoleDTO;
import cc.infoq.common.domain.model.LoginUser;
import cc.infoq.common.exception.SecurityDependencyException;
import cc.infoq.common.exception.ServiceException;
import cc.infoq.common.security.auth.*;
import cc.infoq.common.security.browser.*;
import cc.infoq.common.utils.MapstructUtils;
import cc.infoq.system.domain.bo.SysRoleBo;
import cc.infoq.system.domain.entity.SysRole;
import cc.infoq.system.mapper.*;
import cc.infoq.system.service.SysRoleService;
import cc.infoq.system.service.SysUserService;
import org.junit.jupiter.api.*;
import org.redisson.client.RedisException;
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.annotation.AnnotationTransactionAttributeSource;
import org.springframework.transaction.interceptor.TransactionInterceptor;

import java.time.Duration;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@Tag("dev")
class UserSessionInvalidationTest {
    private final SysUserMapper userMapper = mock(SysUserMapper.class);
    private final SysRoleMapper roleMapper = mock(SysRoleMapper.class);
    private final SysUserRoleMapper userRoles = mock(SysUserRoleMapper.class);
    private final SysUserPostMapper userPosts = mock(SysUserPostMapper.class);
    private final SysRoleDeptMapper roleDepts = mock(SysRoleDeptMapper.class);
    private final Map<String, SecurityTokenSession> sessions = new HashMap<>();
    private final Map<String, BrowserSessionStore.Binding> bindings = new HashMap<>();
    private boolean redisFails;
    private boolean failAfterRevoke;
    private org.springframework.context.support.GenericApplicationContext applicationContext;
    private final SecurityTokenStore tokenStore = new SecurityTokenStore() {
        @Override public void save(String token, SecurityTokenSession session) { sessions.put(session.getTokenDigest(), session); }
        @Override public Optional<SecurityTokenSession> findByDigest(String digest) { return Optional.ofNullable(sessions.get(digest)); }
        @Override public int revokeByUserId(Long userId) {
            if (redisFails) throw new RedisException("isolated dependency failure");
            int before = sessions.size();
            sessions.values().removeIf(session -> userId.equals(session.getUserId()));
            if (failAfterRevoke) throw new RedisException("isolated partial revocation failure");
            return before - sessions.size();
        }
        @Override public int revokeByUserIds(Collection<Long> userIds) {
            if (redisFails) throw new RedisException("isolated dependency failure");
            int before = sessions.size();
            sessions.values().removeIf(session -> userIds.contains(session.getUserId()));
            return before - sessions.size();
        }
        @Override public int revokeByRoleId(Long roleId) {
            if (redisFails) throw new RedisException("isolated dependency failure");
            int before = sessions.size();
            sessions.values().removeIf(session -> session.getRoleIds().contains(roleId));
            return before - sessions.size();
        }
    };
    private SecurityTokenService tokenService;
    private BrowserSessionService browserService;
    private JdbcTemplate jdbc;
    private DataSourceTransactionManager transactions;
    private SysUserService users;

    @BeforeEach
    void setup() {
        cc.infoq.system.TableInfoTestInitializer.initSystemTableInfo();
        applicationContext = new org.springframework.context.support.GenericApplicationContext();
        applicationContext.registerBean(io.github.linpeilie.Converter.class, () -> mock(io.github.linpeilie.Converter.class));
        applicationContext.refresh();
        new cc.infoq.common.utils.SpringUtils().setApplicationContext(applicationContext);
        var dataSource = new DriverManagerDataSource("jdbc:h2:mem:" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1", "sa", "");
        jdbc = new JdbcTemplate(dataSource);
        transactions = new DataSourceTransactionManager(dataSource);
        jdbc.execute("CREATE TABLE accounts (id BIGINT PRIMARY KEY, status VARCHAR(16), password VARCHAR(64))");
        jdbc.update("INSERT INTO accounts VALUES (20,'0','old'),(21,'0','old')");
        jdbc.execute("CREATE TABLE roles (id BIGINT PRIMARY KEY, data_scope VARCHAR(16))");
        jdbc.update("INSERT INTO roles VALUES (6,'1')");
        var properties = new SecurityTokenProperties();
        properties.setSecret("isolated-revocation-unit-test-secret");
        tokenService = new SecurityTokenService(properties, tokenStore);
        BrowserSessionStore store = new BrowserSessionStore() {
            @Override public Binding find(String handle) { return bindings.get(handle); }
            @Override public void save(String handle, Binding value, Duration ttl) { bindings.put(handle, value); }
            @Override public void delete(String handle) { bindings.remove(handle); }
        };
        browserService = new BrowserSessionService(new BrowserSessionProperties(), store, tokenStore, tokenService);
        users = transactional(new SysUserServiceImpl(userMapper, mock(SysDeptMapper.class), roleMapper,
            mock(SysPostMapper.class), userRoles, userPosts, tokenService), SysUserService.class);
    }

    @AfterEach
    void cleanup() {
        jdbc.execute("DROP ALL OBJECTS");
        applicationContext.close();
    }

    @Test
    void disablingUserCommitsStatusAndMakesOriginalBearerAndRecoveryUnusable() {
        String handle = signedIn(20L);
        String token = browserService.restore(handle, "pc", "react").authentication().accessToken();
        when(userMapper.update(eq(null), any())).thenAnswer(call -> jdbc.update("UPDATE accounts SET status='1' WHERE id=20"));
        assertEquals(1, users.updateUserStatus(20L, "1"));
        assertEquals("1", jdbc.queryForObject("SELECT status FROM accounts WHERE id=20", String.class));
        assertThrows(SecurityAuthenticationException.class, () -> tokenService.authenticate(token, "pc"));
        assertEquals(401, assertThrows(BrowserSessionException.class, () -> browserService.restore(handle, "pc", "react")).status());
    }

    @Test
    void passwordChangeInvalidatesSessionAndRedisFailureRollsBackDatabase() {
        String handle = signedIn(20L);
        when(userMapper.update(eq(null), any())).thenAnswer(call -> jdbc.update("UPDATE accounts SET password='new' WHERE id=20"));
        redisFails = true;
        assertThrows(SecurityDependencyException.class, () -> users.resetUserPwd(20L, "new"));
        assertEquals("old", jdbc.queryForObject("SELECT password FROM accounts WHERE id=20", String.class));
        assertTrue(browserService.restore(handle, "pc", "react").remainingSeconds() > 0,
            "a rejected database mutation must not be reported as an updated account");
        redisFails = false;
        users.resetUserPwd(20L, "new");
        assertEquals("new", jdbc.queryForObject("SELECT password FROM accounts WHERE id=20", String.class));
        assertThrows(BrowserSessionException.class, () -> browserService.restore(handle, "pc", "react"));
    }

    @Test
    void zeroRowWriteDoesNotRevokeUnchangedAccount() {
        String handle = signedIn(20L);
        when(userMapper.update(eq(null), any())).thenReturn(0);
        assertEquals(0, users.updateUserStatus(20L, "1"));
        assertEquals(0, users.resetUserPwd(20L, "new"));
        assertTrue(browserService.restore(handle, "pc", "react").remainingSeconds() > 0);
    }

    @Test
    void partialRevocationFailureRollsBackDatabaseWithoutResurrectingRevokedJwt() {
        String handle = signedIn(20L);
        when(userMapper.update(eq(null), any())).thenAnswer(call -> jdbc.update("UPDATE accounts SET status='1' WHERE id=20"));
        failAfterRevoke = true;
        assertThrows(SecurityDependencyException.class, () -> users.updateUserStatus(20L, "1"));
        assertEquals("0", jdbc.queryForObject("SELECT status FROM accounts WHERE id=20", String.class));
        assertThrows(BrowserSessionException.class, () -> browserService.restore(handle, "pc", "react"));
    }

    @Test
    void replacingUserRolesInvalidatesCachedPermissionsAndRecovery() {
        String handle = signedIn(20L);
        when(roleMapper.selectRoleCount(List.of(6L))).thenReturn(1L);
        when(userRoles.insertBatch(any())).thenReturn(true);
        try (var context = mockStatic(LoginUserContext.class)) {
            context.when(() -> LoginUserContext.isSuperAdmin(20L)).thenReturn(false);
            users.insertUserAuth(20L, new Long[]{6L});
        }
        assertThrows(BrowserSessionException.class, () -> browserService.restore(handle, "pc", "react"));
    }

    @Test
    void batchUserDeletionRevokesEveryAffectedUserAndPreservesUnrelatedSession() {
        String first = signedIn(20L);
        String second = signedIn(21L);
        String unrelated = signedIn(22L);
        when(userMapper.deleteByIds(anyCollection())).thenAnswer(call -> jdbc.update("DELETE FROM accounts WHERE id IN (20,21)"));
        try (var context = mockStatic(LoginUserContext.class)) {
            context.when(LoginUserContext::isSuperAdmin).thenReturn(true);
            assertEquals(2, users.deleteUserByIds(new Long[]{20L, 21L}));
        }
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM accounts", Integer.class));
        assertThrows(BrowserSessionException.class, () -> browserService.restore(first, "pc", "react"));
        assertThrows(BrowserSessionException.class, () -> browserService.restore(second, "pc", "react"));
        assertTrue(browserService.restore(unrelated, "pc", "react").remainingSeconds() > 0);
    }

    @Test
    void shrinkingRoleDataScopeRevokesCachedAllDataPermissionAndRecovery() {
        String handle = signedIn(20L);
        var bo = new SysRoleBo(); bo.setRoleId(6L); bo.setDataScope("5"); bo.setDeptIds(new Long[0]);
        var role = new SysRole(); role.setRoleId(6L); role.setDataScope("5");
        when(roleMapper.updateById(any(SysRole.class))).thenAnswer(call -> jdbc.update("UPDATE roles SET data_scope='5' WHERE id=6"));
        var roles = transactional(new SysRoleServiceImpl(roleMapper, mock(SysRoleMenuMapper.class), userRoles, roleDepts, tokenService), SysRoleService.class);
        try (var conversion = mockStatic(MapstructUtils.class)) {
            conversion.when(() -> MapstructUtils.convert(bo, SysRole.class)).thenReturn(role);
            assertEquals(1, roles.authDataScope(bo));
        }
        assertEquals("5", jdbc.queryForObject("SELECT data_scope FROM roles WHERE id=6", String.class));
        assertThrows(BrowserSessionException.class, () -> browserService.restore(handle, "pc", "react"));
    }

    @Test
    void failedRoleDepartmentWriteRollsBackScopeAndPreservesOriginalRecovery() {
        String handle = signedIn(20L);
        jdbc.execute("CREATE TABLE role_departments (role_id BIGINT, dept_id BIGINT)");
        jdbc.update("INSERT INTO role_departments VALUES (6,10)");
        var bo = new SysRoleBo(); bo.setRoleId(6L); bo.setDataScope("2"); bo.setDeptIds(new Long[]{11L});
        var role = new SysRole(); role.setRoleId(6L); role.setDataScope("2");
        when(roleMapper.updateById(any(SysRole.class))).thenAnswer(call -> jdbc.update("UPDATE roles SET data_scope=? WHERE id=?", "2", 6L));
        when(roleDepts.delete(any())).thenAnswer(call -> jdbc.update("DELETE FROM role_departments WHERE role_id=?", 6L));
        when(roleDepts.insertBatch(any())).thenReturn(false);
        var roles = transactional(new SysRoleServiceImpl(roleMapper, mock(SysRoleMenuMapper.class), userRoles, roleDepts, tokenService), SysRoleService.class);
        try (var conversion = mockStatic(MapstructUtils.class)) {
            conversion.when(() -> MapstructUtils.convert(bo, SysRole.class)).thenReturn(role);
            assertThrows(ServiceException.class, () -> roles.authDataScope(bo));
        }
        assertEquals("1", jdbc.queryForObject("SELECT data_scope FROM roles WHERE id=6", String.class));
        assertEquals(10L, jdbc.queryForObject("SELECT dept_id FROM role_departments WHERE role_id=6", Long.class));
        assertTrue(browserService.restore(handle, "pc", "react").remainingSeconds() > 0);
    }

    @Test
    void roleRevocationDependencyFailureRollsBackScopeAndReturnsSanitizedFailure() {
        String handle = signedIn(20L);
        var bo = new SysRoleBo(); bo.setRoleId(6L); bo.setDataScope("5"); bo.setDeptIds(new Long[0]);
        var role = new SysRole(); role.setRoleId(6L); role.setDataScope("5");
        when(roleMapper.updateById(any(SysRole.class))).thenAnswer(call -> jdbc.update("UPDATE roles SET data_scope=? WHERE id=?", "5", 6L));
        var roles = transactional(new SysRoleServiceImpl(roleMapper, mock(SysRoleMenuMapper.class), userRoles, roleDepts, tokenService), SysRoleService.class);
        redisFails = true;
        try (var conversion = mockStatic(MapstructUtils.class)) {
            conversion.when(() -> MapstructUtils.convert(bo, SysRole.class)).thenReturn(role);
            var exception = assertThrows(SecurityDependencyException.class, () -> roles.authDataScope(bo));
            assertEquals("revoke_role", exception.operation());
            assertNull(exception.getCause());
        }
        assertEquals("1", jdbc.queryForObject("SELECT data_scope FROM roles WHERE id=6", String.class));
        assertTrue(browserService.restore(handle, "pc", "react").remainingSeconds() > 0);
    }

    private String signedIn(Long id) {
        var user = new LoginUser(); user.setUserId(id); user.setUserType("sys_user"); user.setUsername("user-" + id);
        var role = new RoleDTO(); role.setRoleId(6L); role.setDataScope("1"); user.setRoles(List.of(role));
        var issued = tokenService.issue(new SecurityTokenIssueRequest(user, "pc", "pc", 3600L, -1L, null));
        return browserService.bind(tokenService.authenticate(issued.accessToken(), "pc"), "pc", "react", null).handle();
    }

    private <T> T transactional(T target, Class<T> type) {
        ProxyFactory factory = new ProxyFactory(target);
        factory.addAdvice(new TransactionInterceptor(transactions, new AnnotationTransactionAttributeSource()));
        return type.cast(factory.getProxy());
    }
}
