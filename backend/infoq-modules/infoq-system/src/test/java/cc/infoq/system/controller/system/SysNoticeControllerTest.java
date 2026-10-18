package cc.infoq.system.controller.system;

import cc.infoq.common.domain.ApiResult;
import cc.infoq.common.mybatis.core.page.PageQuery;
import cc.infoq.common.mybatis.core.page.TableDataInfo;
import cc.infoq.system.domain.bo.SysNoticeBo;
import cc.infoq.system.domain.vo.SysNoticeVo;
import cc.infoq.system.service.SysNoticeService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@Tag("dev")
class SysNoticeControllerTest {

    @Mock
    private SysNoticeService sysNoticeService;
    @InjectMocks
    private SysNoticeController controller;

    @Test
    @DisplayName("list: should return paged notice rows")
    void listShouldReturnPagedNoticeRows() {
        SysNoticeBo bo = new SysNoticeBo();
        PageQuery pageQuery = new PageQuery(1, 10);
        TableDataInfo<SysNoticeVo> table = TableDataInfo.build(java.util.List.of(new SysNoticeVo()));
        when(sysNoticeService.selectPageNoticeList(bo, pageQuery)).thenReturn(table);

        TableDataInfo<SysNoticeVo> result = controller.list(bo, pageQuery);

        assertEquals(1L, result.getTotal());
    }

    @Test
    @DisplayName("getInfo: should return notice detail")
    void getInfoShouldReturnNoticeDetail() {
        SysNoticeVo vo = new SysNoticeVo();
        vo.setNoticeId(6L);
        when(sysNoticeService.selectNoticeById(6L)).thenReturn(vo);

        ApiResult<SysNoticeVo> result = controller.getInfo(6L);

        assertEquals(ApiResult.SUCCESS, result.getCode());
        assertEquals(6L, result.getData().getNoticeId());
    }

    @Test
    @DisplayName("add: should fail when insert rows is zero")
    void addShouldFailWhenInsertRowsZero() {
        SysNoticeBo bo = new SysNoticeBo();
        when(sysNoticeService.insertNotice(bo)).thenReturn(0);

        ApiResult<Void> result = controller.add(bo);

        assertEquals(ApiResult.FAIL, result.getCode());
    }

    @Test
    @DisplayName("edit: should map rows to success response")
    void editShouldMapRowsToSuccessResponse() {
        SysNoticeBo bo = new SysNoticeBo();
        when(sysNoticeService.updateNotice(bo)).thenReturn(1);

        ApiResult<Void> result = controller.edit(bo);

        assertEquals(ApiResult.SUCCESS, result.getCode());
    }

    @Test
    @DisplayName("remove: should map rows to success response")
    void removeShouldMapRowsToSuccessResponse() {
        when(sysNoticeService.deleteNoticeByIds(org.mockito.ArgumentMatchers.any(Long[].class))).thenReturn(2);

        ApiResult<Void> result = controller.remove(new Long[]{1L, 2L});

        assertEquals(ApiResult.SUCCESS, result.getCode());
    }
}
