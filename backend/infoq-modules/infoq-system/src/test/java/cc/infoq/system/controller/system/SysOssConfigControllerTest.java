package cc.infoq.system.controller.system;

import cc.infoq.common.domain.ApiResult;
import cc.infoq.common.mybatis.core.page.PageQuery;
import cc.infoq.common.mybatis.core.page.TableDataInfo;
import cc.infoq.system.domain.bo.SysOssConfigBo;
import cc.infoq.system.domain.vo.SysOssConfigVo;
import cc.infoq.system.service.SysOssConfigService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@Tag("dev")
class SysOssConfigControllerTest {

    @Mock
    private SysOssConfigService sysOssConfigService;

    @InjectMocks
    private SysOssConfigController controller;

    @Test
    @DisplayName("list: should return paged oss config data")
    void listShouldReturnPagedOssConfigData() {
        SysOssConfigBo bo = new SysOssConfigBo();
        PageQuery pageQuery = new PageQuery(1, 10);
        TableDataInfo<SysOssConfigVo> table = TableDataInfo.build(List.of(new SysOssConfigVo()));
        when(sysOssConfigService.queryPageList(bo, pageQuery)).thenReturn(table);

        TableDataInfo<SysOssConfigVo> result = controller.list(bo, pageQuery);

        assertEquals(1L, result.getTotal());
    }

    @Test
    @DisplayName("getInfo: should return oss config detail")
    void getInfoShouldReturnOssConfigDetail() {
        SysOssConfigVo vo = new SysOssConfigVo();
        vo.setOssConfigId(3L);
        when(sysOssConfigService.queryById(3L)).thenReturn(vo);

        ApiResult<SysOssConfigVo> result = controller.getInfo(3L);

        assertEquals(ApiResult.SUCCESS, result.getCode());
        assertEquals(3L, result.getData().getOssConfigId());
    }

    @Test
    @DisplayName("add: should map insert rows to success")
    void addShouldMapInsertRowsToSuccess() {
        SysOssConfigBo bo = new SysOssConfigBo();
        when(sysOssConfigService.insertByBo(bo)).thenReturn(true);

        ApiResult<Void> result = controller.add(bo);

        assertEquals(ApiResult.SUCCESS, result.getCode());
    }

    @Test
    @DisplayName("edit: should map update rows to success")
    void editShouldMapUpdateRowsToSuccess() {
        SysOssConfigBo bo = new SysOssConfigBo();
        when(sysOssConfigService.updateByBo(bo)).thenReturn(true);

        ApiResult<Void> result = controller.edit(bo);

        assertEquals(ApiResult.SUCCESS, result.getCode());
    }

    @Test
    @DisplayName("remove: should map delete rows to success")
    void removeShouldMapDeleteRowsToSuccess() {
        when(sysOssConfigService.deleteWithValidByIds(List.of(9L, 10L), true)).thenReturn(true);

        ApiResult<Void> result = controller.remove(new Long[]{9L, 10L});

        assertEquals(ApiResult.SUCCESS, result.getCode());
        verify(sysOssConfigService).deleteWithValidByIds(List.of(9L, 10L), true);
    }

    @Test
    @DisplayName("changeStatus: should map rows to success result")
    void changeStatusShouldMapRowsToSuccess() {
        SysOssConfigBo bo = new SysOssConfigBo();
        when(sysOssConfigService.updateOssConfigStatus(bo)).thenReturn(1);

        ApiResult<Void> result = controller.changeStatus(bo);

        assertEquals(ApiResult.SUCCESS, result.getCode());
    }
}
