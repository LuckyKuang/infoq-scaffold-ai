package cc.infoq.system.service.impl;

import cc.infoq.common.log.event.OperLogEvent;
import cc.infoq.common.utils.MapstructUtils;
import cc.infoq.common.utils.SpringUtils;
import cc.infoq.common.utils.ip.AddressUtils;
import cc.infoq.system.TableInfoTestInitializer;
import cc.infoq.system.mapper.SysOperLogMapper;
import cc.infoq.common.mybatis.core.page.PageQuery;
import cc.infoq.common.mybatis.core.page.TableDataInfo;
import cc.infoq.system.domain.bo.SysOperLogBo;
import cc.infoq.system.domain.entity.SysOperLog;
import cc.infoq.system.domain.vo.SysOperLogVo;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import io.github.linpeilie.Converter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.support.GenericApplicationContext;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
@Tag("dev")
class SysOperLogServiceImplTest {

    @Mock
    private SysOperLogMapper sysOperLogMapper;

    @BeforeEach
    void setUp() {
        TableInfoTestInitializer.initSystemTableInfo();
        GenericApplicationContext context = new GenericApplicationContext();
        context.registerBean(Converter.class, () -> mock(Converter.class));
        context.refresh();
        new SpringUtils().setApplicationContext(context);
    }

    @Test
    @DisplayName("deleteOperLogByIds: should return mapper delete rows")
    void deleteOperLogByIdsShouldReturnRows() {
        SysOperLogServiceImpl service = new SysOperLogServiceImpl(sysOperLogMapper);
        when(sysOperLogMapper.deleteByIds(anyList())).thenReturn(2);

        int rows = service.deleteOperLogByIds(new Long[]{10L, 11L});

        assertEquals(2, rows);
    }

    @Test
    @DisplayName("selectPageOperLogList: should build query and return paged rows")
    void selectPageOperLogListShouldBuildQueryAndReturnPagedRows() {
        SysOperLogServiceImpl service = new SysOperLogServiceImpl(sysOperLogMapper);
        SysOperLogBo bo = new SysOperLogBo();
        bo.setOperIp("127.0.0.1");
        bo.setTitle("用户管理");
        bo.setBusinessType(1);
        bo.setBusinessTypes(new Integer[]{1, 2});
        bo.setStatus(0);
        bo.setOperName("admin");
        bo.getParams().put("beginTime", "2026-03-01 00:00:00");
        bo.getParams().put("endTime", "2026-03-31 23:59:59");
        Page<SysOperLogVo> page = new Page<>();
        SysOperLogVo vo = new SysOperLogVo();
        vo.setOperId(8L);
        page.setRecords(List.of(vo));
        page.setTotal(1);
        when(sysOperLogMapper.selectVoPage(any(), any())).thenReturn(page);

        TableDataInfo<SysOperLogVo> result = service.selectPageOperLogList(bo, new PageQuery(10, 1));

        assertEquals(1, result.getTotal());
        assertEquals(1, result.getRows().size());
        assertEquals(8L, result.getRows().get(0).getOperId());
    }

    @Test
    @DisplayName("selectOperLogList/selectOperLogById: should delegate to mapper")
    void selectOperLogListAndByIdShouldDelegateToMapper() {
        SysOperLogServiceImpl service = new SysOperLogServiceImpl(sysOperLogMapper);
        SysOperLogBo bo = new SysOperLogBo();
        bo.setOperName("ops");
        bo.getParams().put("beginTime", "2026-03-01 00:00:00");
        bo.getParams().put("endTime", "2026-03-31 23:59:59");
        SysOperLogVo vo = new SysOperLogVo();
        vo.setOperId(3L);
        when(sysOperLogMapper.selectVoList(any())).thenReturn(List.of(vo));
        when(sysOperLogMapper.selectVoById(3L)).thenReturn(vo);

        List<SysOperLogVo> list = service.selectOperLogList(bo);
        SysOperLogVo byId = service.selectOperLogById(3L);

        assertEquals(1, list.size());
        assertEquals(3L, list.get(0).getOperId());
        assertEquals(3L, byId.getOperId());
    }

    @Test
    @DisplayName("cleanOperLog: should call mapper delete")
    void cleanOperLogShouldCallMapperDelete() {
        SysOperLogServiceImpl service = new SysOperLogServiceImpl(sysOperLogMapper);

        service.cleanOperLog();

        verify(sysOperLogMapper).delete(any());
    }

    @Test
    @DisplayName("insertOperLog: should convert bo, set time and persist")
    void insertOperLogShouldConvertSetTimeAndPersist() {
        SysOperLogServiceImpl service = new SysOperLogServiceImpl(sysOperLogMapper);
        SysOperLogBo bo = new SysOperLogBo();
        bo.setTitle("用户管理");
        SysOperLog entity = new SysOperLog();
        entity.setTitle("用户管理");

        try (MockedStatic<MapstructUtils> mapstructUtils = mockStatic(MapstructUtils.class)) {
            mapstructUtils.when(() -> MapstructUtils.convert(bo, SysOperLog.class)).thenReturn(entity);

            service.insertOperLog(bo);

            assertEquals("用户管理", entity.getTitle());
            verify(sysOperLogMapper).insert(entity);
        }
    }

    @Test
    @DisplayName("recordOper: should convert event, resolve location and insert oper log")
    void recordOperShouldConvertEventResolveLocationAndInsert() {
        SysOperLogServiceImpl service = new SysOperLogServiceImpl(sysOperLogMapper);
        OperLogEvent event = new OperLogEvent();
        SysOperLogBo bo = new SysOperLogBo();
        bo.setOperIp("127.0.0.1");
        bo.setTitle("审计");
        SysOperLog entity = new SysOperLog();

        try (MockedStatic<MapstructUtils> mapstructUtils = mockStatic(MapstructUtils.class);
             MockedStatic<AddressUtils> addressUtils = mockStatic(AddressUtils.class)) {
            mapstructUtils.when(() -> MapstructUtils.convert(event, SysOperLogBo.class)).thenReturn(bo);
            mapstructUtils.when(() -> MapstructUtils.convert(bo, SysOperLog.class)).thenReturn(entity);
            addressUtils.when(() -> AddressUtils.getRealAddressByIP("127.0.0.1")).thenReturn("内网IP");

            service.recordOper(event);

            assertEquals("内网IP", bo.getOperLocation());
            verify(sysOperLogMapper).insert(entity);
        }
    }
}
