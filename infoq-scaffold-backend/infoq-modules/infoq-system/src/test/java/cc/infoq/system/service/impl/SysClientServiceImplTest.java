package cc.infoq.system.service.impl;

import cc.infoq.common.mybatis.core.page.PageQuery;
import cc.infoq.common.mybatis.core.page.TableDataInfo;
import cc.infoq.common.utils.MapstructUtils;
import cc.infoq.common.utils.SpringUtils;
import cc.infoq.system.TableInfoTestInitializer;
import cc.infoq.system.domain.bo.SysClientBo;
import cc.infoq.system.domain.entity.SysClient;
import cc.infoq.system.domain.vo.SysClientVo;
import cc.infoq.system.mapper.SysClientMapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import io.github.linpeilie.Converter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.support.GenericApplicationContext;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.mockStatic;

@ExtendWith(MockitoExtension.class)
@Tag("dev")
class SysClientServiceImplTest {

    @Mock
    private SysClientMapper sysClientMapper;

    @InjectMocks
    private SysClientServiceImpl sysClientService;

    @BeforeEach
    void setUp() {
        TableInfoTestInitializer.initSystemTableInfo();
        GenericApplicationContext context = new GenericApplicationContext();
        context.registerBean(Converter.class, () -> org.mockito.Mockito.mock(Converter.class));
        context.refresh();
        new SpringUtils().setApplicationContext(context);
    }

    @Test
    @DisplayName("queryById: when client exists, grantType should split to list")
    void queryByIdShouldSplitGrantTypeList() {
        SysClientVo vo = new SysClientVo();
        vo.setId(1L);
        vo.setGrantType("password,email");
        when(sysClientMapper.selectVoById(1L)).thenReturn(vo);

        SysClientVo result = sysClientService.queryById(1L);

        assertNotNull(result);
        assertEquals(List.of("password", "email"), result.getGrantTypeList());
    }

    @Test
    @DisplayName("queryById: when client missing, should return null")
    void queryByIdShouldReturnNullWhenMissing() {
        when(sysClientMapper.selectVoById(99L)).thenReturn(null);

        SysClientVo result = sysClientService.queryById(99L);

        assertNull(result);
    }

    @Test
    @DisplayName("queryPageList: should return paged response from mapper")
    void queryPageListShouldReturnPagedData() {
        SysClientBo bo = new SysClientBo();
        PageQuery pageQuery = new PageQuery(10, 1);
        com.baomidou.mybatisplus.extension.plugins.pagination.Page<SysClientVo> page =
            new com.baomidou.mybatisplus.extension.plugins.pagination.Page<>(1, 10);
        SysClientVo vo = new SysClientVo();
        vo.setGrantType("password");
        page.setRecords(List.of(vo));
        page.setTotal(1L);
        when(sysClientMapper.selectVoPage(any(), any())).thenReturn(page);

        TableDataInfo<SysClientVo> result = sysClientService.queryPageList(bo, pageQuery);

        assertEquals(1L, result.getTotal());
        assertEquals(1, result.getRows().size());
        assertEquals(List.of("password"), result.getRows().get(0).getGrantTypeList());
    }

    @Test
    @DisplayName("checkClickKeyUnique: should return false when mapper says exists")
    void checkClickKeyUniqueShouldReturnFalseWhenExists() {
        SysClientBo bo = new SysClientBo();
        bo.setId(1L);
        bo.setClientKey("web");
        when(sysClientMapper.exists(any())).thenReturn(true);

        boolean unique = sysClientService.checkClickKeyUnique(bo);

        assertFalse(unique);
    }

    @Test
    @DisplayName("queryByClientId: should return mapper result directly")
    void queryByClientIdShouldReturnMapperResult() {
        SysClientVo vo = new SysClientVo();
        vo.setClientId("cid");
        when(sysClientMapper.selectVoOne(any())).thenReturn(vo);

        SysClientVo result = sysClientService.queryByClientId("cid");

        assertSame(vo, result);
    }

    @Test
    @DisplayName("queryList: should return mapper list")
    void queryListShouldReturnMapperList() {
        SysClientBo bo = new SysClientBo();
        SysClientVo vo = new SysClientVo();
        vo.setClientId("client-a");
        when(sysClientMapper.selectVoList(any())).thenReturn(List.of(vo));

        List<SysClientVo> result = sysClientService.queryList(bo);

        assertEquals(1, result.size());
        assertEquals("client-a", result.get(0).getClientId());
    }

    @Test
    @DisplayName("updateClientStatus: should build status update and return affected rows")
    void updateClientStatusShouldBuildStatusUpdateAndReturnAffectedRows() {
        when(sysClientMapper.update(any(), any())).thenReturn(1);

        int rows = sysClientService.updateClientStatus("client-a", "1");

        assertEquals(1, rows);
        ArgumentCaptor<LambdaUpdateWrapper<SysClient>> wrapperCaptor = ArgumentCaptor.forClass(LambdaUpdateWrapper.class);
        verify(sysClientMapper).update(isNull(), wrapperCaptor.capture());
        LambdaUpdateWrapper<SysClient> wrapper = wrapperCaptor.getValue();
        assertTrue(wrapper.getSqlSet().contains("status"));
        assertTrue(wrapper.getParamNameValuePairs().containsValue("1"));
    }

    @Test
    @DisplayName("deleteWithValidByIds: should return true when mapper deletes rows")
    void deleteWithValidByIdsShouldReturnTrueWhenRowsPositive() {
        when(sysClientMapper.deleteByIds(List.of(9L, 10L))).thenReturn(2);

        Boolean result = sysClientService.deleteWithValidByIds(List.of(9L, 10L), true);

        assertTrue(result);
        verify(sysClientMapper).deleteByIds(List.of(9L, 10L));
    }

    @Test
    @DisplayName("insertByBo: should join grantType, generate clientId and backfill bo id")
    void insertByBoShouldJoinGrantTypeAndBackfillId() {
        SysClientBo bo = new SysClientBo();
        bo.setClientKey("web");
        bo.setClientSecret("secret");
        bo.setGrantTypeList(List.of("password", "email"));
        SysClient converted = new SysClient();
        converted.setId(77L);

        when(sysClientMapper.insert(any(SysClient.class))).thenReturn(1);

        try (MockedStatic<MapstructUtils> mapstructUtils = mockStatic(MapstructUtils.class)) {
            mapstructUtils.when(() -> MapstructUtils.convert(bo, SysClient.class)).thenReturn(converted);

            Boolean result = sysClientService.insertByBo(bo);

            assertTrue(result);
            assertEquals(77L, bo.getId());
            ArgumentCaptor<SysClient> captor = ArgumentCaptor.forClass(SysClient.class);
            verify(sysClientMapper).insert(captor.capture());
            assertEquals("password,email", captor.getValue().getGrantType());
            assertNotNull(captor.getValue().getClientId());
            assertFalse(captor.getValue().getClientId().isBlank());
        }
    }

    @Test
    @DisplayName("updateByBo: should join grantType and delegate to mapper updateById")
    void updateByBoShouldJoinGrantTypeAndUpdate() {
        SysClientBo bo = new SysClientBo();
        bo.setId(88L);
        bo.setGrantTypeList(List.of("password", "client_credentials"));
        SysClient converted = new SysClient();
        converted.setId(88L);

        when(sysClientMapper.updateById(any(SysClient.class))).thenReturn(1);

        try (MockedStatic<MapstructUtils> mapstructUtils = mockStatic(MapstructUtils.class)) {
            mapstructUtils.when(() -> MapstructUtils.convert(bo, SysClient.class)).thenReturn(converted);

            Boolean result = sysClientService.updateByBo(bo);

            assertTrue(result);
            ArgumentCaptor<SysClient> captor = ArgumentCaptor.forClass(SysClient.class);
            verify(sysClientMapper).updateById(captor.capture());
            assertEquals("password,client_credentials", captor.getValue().getGrantType());
        }
    }
}
