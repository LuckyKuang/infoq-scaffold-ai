package cc.infoq.system.service.impl;

import cc.infoq.common.utils.MapstructUtils;
import cc.infoq.common.utils.SpringUtils;
import cc.infoq.system.domain.bo.SysNoticeBo;
import cc.infoq.system.domain.entity.SysNotice;
import cc.infoq.system.domain.vo.SysNoticeVo;
import cc.infoq.system.mapper.SysNoticeMapper;
import cc.infoq.system.mapper.SysUserMapper;
import cc.infoq.system.service.SysMessageService;
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
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@Tag("dev")
class SysNoticeServiceImplTest {

    @Mock
    private SysNoticeMapper sysNoticeMapper;
    @Mock
    private SysUserMapper sysUserMapper;
    @Mock
    private SysMessageService sysMessageService;

    @BeforeEach
    void setUp() {
        GenericApplicationContext context = new GenericApplicationContext();
        context.registerBean(Converter.class, () -> org.mockito.Mockito.mock(Converter.class));
        context.refresh();
        new SpringUtils().setApplicationContext(context);
    }

    @Test
    @DisplayName("deleteNoticeByIds: should return rows from mapper")
    void deleteNoticeByIdsShouldReturnMapperRows() {
        SysNoticeServiceImpl service = new SysNoticeServiceImpl(sysNoticeMapper, sysUserMapper, sysMessageService);
        when(sysNoticeMapper.deleteByIds(anyList())).thenReturn(2);

        int rows = service.deleteNoticeByIds(new Long[]{1L, 2L});

        assertEquals(2, rows);
    }

    @Test
    @DisplayName("selectNoticeById/deleteNoticeById: should delegate to mapper")
    void selectAndDeleteByIdShouldDelegate() {
        SysNoticeServiceImpl service = new SysNoticeServiceImpl(sysNoticeMapper, sysUserMapper, sysMessageService);
        SysNoticeVo noticeVo = new SysNoticeVo();
        noticeVo.setNoticeId(11L);
        when(sysNoticeMapper.selectVoById(11L)).thenReturn(noticeVo);
        when(sysNoticeMapper.deleteById(11L)).thenReturn(1);

        SysNoticeVo selected = service.selectNoticeById(11L);
        int rows = service.deleteNoticeById(11L);

        assertSame(noticeVo, selected);
        assertEquals(1, rows);
    }

    @Test
    @DisplayName("selectNoticeList/selectPageNoticeList: should delegate with wrapper and return mapper data")
    void selectNoticeListAndPageShouldReturnMapperData() {
        SysNoticeServiceImpl service = new SysNoticeServiceImpl(sysNoticeMapper, sysUserMapper, sysMessageService);
        SysNoticeBo bo = new SysNoticeBo();
        bo.setNoticeTitle("公告");
        SysNoticeVo vo = new SysNoticeVo();
        vo.setNoticeId(22L);
        Page<SysNoticeVo> page = new Page<>(1, 10);
        page.setRecords(List.of(vo));
        page.setTotal(1L);
        when(sysNoticeMapper.selectVoList(any())).thenReturn(List.of(vo));
        when(sysNoticeMapper.selectVoPage(any(), any())).thenReturn(page);

        List<SysNoticeVo> list = service.selectNoticeList(bo);
        var table = service.selectPageNoticeList(bo, new cc.infoq.common.mybatis.core.page.PageQuery(10, 1));

        assertEquals(1, list.size());
        assertEquals(22L, list.get(0).getNoticeId());
        assertEquals(1L, table.getTotal());
        assertEquals(1, table.getRows().size());
    }

    @Test
    @DisplayName("insertNotice/updateNotice: should convert bo and delegate to mapper")
    void insertNoticeAndUpdateNoticeShouldConvertAndDelegate() {
        SysNoticeServiceImpl service = new SysNoticeServiceImpl(sysNoticeMapper, sysUserMapper, sysMessageService);
        SysNoticeBo bo = new SysNoticeBo();
        bo.setNoticeId(30L);
        bo.setNoticeTitle("系统维护");
        SysNotice converted = new SysNotice();
        converted.setNoticeId(30L);
        converted.setNoticeTitle("系统维护");
        when(sysNoticeMapper.insert(converted)).thenReturn(1);
        when(sysNoticeMapper.updateById(converted)).thenReturn(1);

        try (MockedStatic<MapstructUtils> mapstructUtils = mockStatic(MapstructUtils.class)) {
            mapstructUtils.when(() -> MapstructUtils.convert(bo, SysNotice.class)).thenReturn(converted);

            int insertRows = service.insertNotice(bo);
            int updateRows = service.updateNotice(bo);

            assertEquals(1, insertRows);
            assertEquals(1, updateRows);
            verify(sysMessageService).publishSystemNotice("系统维护", null, null, "notice:30");
        }
    }
}
