package cc.infoq.system.service.impl;

import cc.infoq.common.constant.Constants;
import cc.infoq.common.log.event.LoginInfoEvent;
import cc.infoq.common.mybatis.core.page.PageQuery;
import cc.infoq.common.mybatis.core.page.TableDataInfo;
import cc.infoq.common.security.auth.SecurityAuthNames;
import cc.infoq.common.utils.MapstructUtils;
import cc.infoq.common.utils.SpringUtils;
import cc.infoq.common.utils.ip.AddressUtils;
import cc.infoq.system.domain.bo.SysLoginInfoBo;
import cc.infoq.system.domain.entity.SysLoginInfo;
import cc.infoq.system.domain.vo.SysClientVo;
import cc.infoq.system.domain.vo.SysLoginInfoVo;
import cc.infoq.system.mapper.SysLoginInfoMapper;
import cc.infoq.system.service.SysClientService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import io.github.linpeilie.Converter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.support.GenericApplicationContext;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@Tag("dev")
class SysLoginInfoServiceImplTest {

    @Mock
    private SysLoginInfoMapper sysLoginInfoMapper;
    @Mock
    private SysClientService sysClientService;
    private Converter converter;
    private SysLoginInfoServiceImpl service;

    @BeforeEach
    void setUp() {
        converter = org.mockito.Mockito.mock(Converter.class);
        GenericApplicationContext context = new GenericApplicationContext();
        context.registerBean(Converter.class, () -> converter);
        context.refresh();
        new SpringUtils().setApplicationContext(context);
        service = new SysLoginInfoServiceImpl(sysLoginInfoMapper, sysClientService);
    }

    @Test
    @DisplayName("deleteLoginInfoByIds: should delegate to mapper and return rows")
    void deleteLoginInfoByIdsShouldReturnRows() {
        when(sysLoginInfoMapper.deleteByIds(anyList())).thenReturn(2);

        int rows = service.deleteLoginInfoByIds(new Long[]{1L, 2L});

        assertEquals(2, rows);
    }

    @Test
    @DisplayName("selectPageLoginInfoList: should build page result with default order when orderBy is blank")
    void selectPageLoginInfoListShouldReturnPagedResult() {
        SysLoginInfoBo bo = new SysLoginInfoBo();
        bo.setIpaddr("127.0.0.1");
        bo.setStatus(Constants.SUCCESS);
        bo.setUserName("admin");
        bo.getParams().put("beginTime", "2026-03-01 00:00:00");
        bo.getParams().put("endTime", "2026-03-08 23:59:59");
        PageQuery pageQuery = new PageQuery(10, 1);

        Page<SysLoginInfoVo> page = new Page<>(1, 10);
        SysLoginInfoVo vo = new SysLoginInfoVo();
        vo.setUserName("admin");
        page.setRecords(java.util.List.of(vo));
        page.setTotal(1L);
        when(sysLoginInfoMapper.selectVoPage(any(), any())).thenReturn(page);

        TableDataInfo<SysLoginInfoVo> result = service.selectPageLoginInfoList(bo, pageQuery);

        assertEquals(1L, result.getTotal());
        assertEquals(1, result.getRows().size());
        assertEquals("admin", result.getRows().get(0).getUserName());
        verify(sysLoginInfoMapper).selectVoPage(any(), any());
    }

    @Test
    @DisplayName("selectPageLoginInfoList: should honor custom orderBy column when provided")
    void selectPageLoginInfoListShouldSupportCustomOrderBy() {
        SysLoginInfoBo bo = new SysLoginInfoBo();
        PageQuery pageQuery = new PageQuery(10, 1);
        pageQuery.setOrderByColumn("infoId");
        pageQuery.setIsAsc("asc");
        when(sysLoginInfoMapper.selectVoPage(any(), any())).thenReturn(new Page<>(1, 10));

        TableDataInfo<SysLoginInfoVo> result = service.selectPageLoginInfoList(bo, pageQuery);

        assertEquals(0L, result.getTotal());
        verify(sysLoginInfoMapper).selectVoPage(any(), any());
    }

    @Test
    @DisplayName("selectLoginInfoList: should delegate query and return mapper result")
    void selectLoginInfoListShouldReturnMapperResult() {
        SysLoginInfoBo bo = new SysLoginInfoBo();
        bo.setUserName("admin");
        java.util.List<SysLoginInfoVo> expected = java.util.List.of(new SysLoginInfoVo());
        when(sysLoginInfoMapper.selectVoList(any())).thenReturn(expected);

        java.util.List<SysLoginInfoVo> result = service.selectLoginInfoList(bo);

        assertSame(expected, result);
        verify(sysLoginInfoMapper).selectVoList(any());
    }

    @Test
    @DisplayName("cleanLoginInfo: should clear all login records")
    void cleanLoginInfoShouldDeleteAllRows() {
        service.cleanLoginInfo();

        verify(sysLoginInfoMapper).delete(any());
    }

    @Test
    @DisplayName("insertLoginInfo: should convert bo, set login time and persist")
    void insertLoginInfoShouldConvertAndPersist() {
        SysLoginInfoBo bo = new SysLoginInfoBo();
        bo.setUserName("admin");
        SysLoginInfo entity = new SysLoginInfo();
        try (MockedStatic<MapstructUtils> mapstructUtils = mockStatic(MapstructUtils.class)) {
            mapstructUtils.when(() -> MapstructUtils.convert(bo, SysLoginInfo.class)).thenReturn(entity);

            service.insertLoginInfo(bo);

            assertEquals("admin", bo.getUserName());
            org.junit.jupiter.api.Assertions.assertNotNull(entity.getLoginTime());
            verify(sysLoginInfoMapper).insert(entity);
        }
    }

    @Test
    @DisplayName("recordLoginInfo: should map success status and client metadata")
    void recordLoginInfoShouldMapSuccessStatusAndClientMetadata() {
        SysLoginInfoServiceImpl serviceSpy = spy(service);
        ArgumentCaptor<SysLoginInfoBo> captor = ArgumentCaptor.forClass(SysLoginInfoBo.class);
        doNothing().when(serviceSpy).insertLoginInfo(captor.capture());

        SysClientVo clientVo = new SysClientVo();
        clientVo.setClientKey("pc");
        clientVo.setDeviceType("web");
        when(sysClientService.queryByClientId("client-1")).thenReturn(clientVo);

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRequestURI("/auth/login");
        request.setRemoteAddr("127.0.0.1");
        request.addHeader("User-Agent", "Mozilla/5.0");
        request.addHeader(SecurityAuthNames.CLIENT_ID, "client-1");

        LoginInfoEvent event = new LoginInfoEvent();
        event.setRequest(request);
        event.setUsername("admin");
        event.setStatus(Constants.LOGIN_SUCCESS);
        event.setMessage("登录成功");

        try (MockedStatic<AddressUtils> addressUtils = mockStatic(AddressUtils.class)) {
            addressUtils.when(() -> AddressUtils.getRealAddressByIP(anyString())).thenReturn("内网IP");
            serviceSpy.recordLoginInfo(event);
        }

        SysLoginInfoBo bo = captor.getValue();
        assertEquals("admin", bo.getUserName());
        assertEquals("pc", bo.getClientKey());
        assertEquals("web", bo.getDeviceType());
        assertEquals(Constants.SUCCESS, bo.getStatus());
        assertEquals("登录成功", bo.getMsg());
        assertEquals("内网IP", bo.getLoginLocation());
    }

    @Test
    @DisplayName("recordLoginInfo: should map fail status without client metadata")
    void recordLoginInfoShouldMapFailStatusWithoutClientMetadata() {
        SysLoginInfoServiceImpl serviceSpy = spy(service);
        ArgumentCaptor<SysLoginInfoBo> captor = ArgumentCaptor.forClass(SysLoginInfoBo.class);
        doNothing().when(serviceSpy).insertLoginInfo(captor.capture());

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRequestURI("/auth/login");
        request.setRemoteAddr("127.0.0.1");
        request.addHeader("User-Agent", "Mozilla/5.0");

        LoginInfoEvent event = new LoginInfoEvent();
        event.setRequest(request);
        event.setUsername("admin");
        event.setStatus(Constants.LOGIN_FAIL);
        event.setMessage("登录失败");

        try (MockedStatic<AddressUtils> addressUtils = mockStatic(AddressUtils.class)) {
            addressUtils.when(() -> AddressUtils.getRealAddressByIP(anyString())).thenReturn("内网IP");
            serviceSpy.recordLoginInfo(event);
        }

        SysLoginInfoBo bo = captor.getValue();
        assertEquals(Constants.FAIL, bo.getStatus());
        assertNull(bo.getClientKey());
        assertNull(bo.getDeviceType());
        verifyNoInteractions(sysClientService);
    }

    @Test
    @DisplayName("recordLoginInfo: should prefer runtime mini-program headers over client defaults")
    void recordLoginInfoShouldPreferRuntimeHeadersOverClientDefaults() {
        SysLoginInfoServiceImpl serviceSpy = spy(service);
        ArgumentCaptor<SysLoginInfoBo> captor = ArgumentCaptor.forClass(SysLoginInfoBo.class);
        doNothing().when(serviceSpy).insertLoginInfo(captor.capture());

        SysClientVo clientVo = new SysClientVo();
        clientVo.setClientKey("pc");
        clientVo.setDeviceType("pc");
        when(sysClientService.queryByClientId("client-1")).thenReturn(clientVo);

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRequestURI("/auth/login");
        request.setRemoteAddr("127.0.0.1");
        request.addHeader("User-Agent", "Mozilla/5.0");
        request.addHeader(SecurityAuthNames.CLIENT_ID, "client-1");
        request.addHeader("x-client-key", "miniapp");
        request.addHeader("x-device-type", "miniapp");

        LoginInfoEvent event = new LoginInfoEvent();
        event.setRequest(request);
        event.setUsername("admin");
        event.setStatus(Constants.LOGIN_SUCCESS);
        event.setMessage("登录成功");

        try (MockedStatic<AddressUtils> addressUtils = mockStatic(AddressUtils.class)) {
            addressUtils.when(() -> AddressUtils.getRealAddressByIP(anyString())).thenReturn("内网IP");
            serviceSpy.recordLoginInfo(event);
        }

        SysLoginInfoBo bo = captor.getValue();
        assertEquals("miniapp", bo.getClientKey());
        assertEquals("miniapp", bo.getDeviceType());
        assertEquals(Constants.SUCCESS, bo.getStatus());
    }

    @Test
    @DisplayName("recordLoginInfo: should tolerate missing request context")
    void recordLoginInfoShouldTolerateMissingRequestContext() {
        SysLoginInfoServiceImpl serviceSpy = spy(service);
        ArgumentCaptor<SysLoginInfoBo> captor = ArgumentCaptor.forClass(SysLoginInfoBo.class);
        doNothing().when(serviceSpy).insertLoginInfo(captor.capture());

        LoginInfoEvent event = new LoginInfoEvent();
        event.setUsername("admin");
        event.setStatus(Constants.LOGIN_FAIL);
        event.setMessage("登录失败");

        try (MockedStatic<AddressUtils> addressUtils = mockStatic(AddressUtils.class)) {
            addressUtils.when(() -> AddressUtils.getRealAddressByIP(eq(""))).thenReturn("未知");
            serviceSpy.recordLoginInfo(event);
        }

        SysLoginInfoBo bo = captor.getValue();
        assertEquals("admin", bo.getUserName());
        assertEquals(Constants.FAIL, bo.getStatus());
        assertEquals("登录失败", bo.getMsg());
        assertEquals("", bo.getIpaddr());
        assertEquals("未知", bo.getLoginLocation());
        verifyNoInteractions(sysClientService);
    }
}
