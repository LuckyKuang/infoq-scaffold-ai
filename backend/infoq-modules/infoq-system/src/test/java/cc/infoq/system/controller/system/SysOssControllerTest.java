package cc.infoq.system.controller.system;

import cc.infoq.common.domain.ApiResult;
import cc.infoq.common.mybatis.core.page.PageQuery;
import cc.infoq.common.mybatis.core.page.TableDataInfo;
import cc.infoq.system.domain.bo.SysOssBo;
import cc.infoq.system.domain.vo.SysOssUploadVo;
import cc.infoq.system.domain.vo.SysOssVo;
import cc.infoq.system.service.SysOssService;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@Tag("dev")
class SysOssControllerTest {

    @Mock
    private SysOssService sysOssService;

    @InjectMocks
    private SysOssController controller;

    @Test
    @DisplayName("list: should return paged oss list from service")
    void listShouldReturnPagedOssListFromService() {
        SysOssBo bo = new SysOssBo();
        PageQuery pageQuery = new PageQuery(1, 10);
        TableDataInfo<SysOssVo> table = TableDataInfo.build(List.of(new SysOssVo()));
        when(sysOssService.queryPageList(bo, pageQuery)).thenReturn(table);

        TableDataInfo<SysOssVo> result = controller.list(bo, pageQuery);

        assertEquals(1L, result.getTotal());
    }

    @Test
    @DisplayName("listByIds: should return oss list from service")
    void listByIdsShouldReturnServiceData() {
        SysOssVo vo = new SysOssVo();
        vo.setOssId(1L);
        when(sysOssService.listByIds(List.of(1L, 2L))).thenReturn(List.of(vo));

        ApiResult<List<SysOssVo>> result = controller.listByIds(new Long[]{1L, 2L});

        assertEquals(ApiResult.SUCCESS, result.getCode());
        assertEquals(1, result.getData().size());
        assertEquals(1L, result.getData().get(0).getOssId());
    }

    @Test
    @DisplayName("upload: should map uploaded oss info to upload vo")
    void uploadShouldMapUploadedOssInfoToUploadVo() {
        MultipartFile file = org.mockito.Mockito.mock(MultipartFile.class);
        SysOssVo ossVo = new SysOssVo();
        ossVo.setOssId(88L);
        ossVo.setOriginalName("avatar.png");
        ossVo.setUrl("https://oss.test/avatar.png");
        when(sysOssService.upload(file)).thenReturn(ossVo);

        ApiResult<SysOssUploadVo> result = controller.upload(file);

        assertEquals(ApiResult.SUCCESS, result.getCode());
        assertEquals("88", result.getData().getOssId());
        assertEquals("avatar.png", result.getData().getFileName());
        assertEquals("https://oss.test/avatar.png", result.getData().getUrl());
    }

    @Test
    @DisplayName("download: should delegate download to service")
    void downloadShouldDelegateToService() throws IOException {
        HttpServletResponse response = org.mockito.Mockito.mock(HttpServletResponse.class);

        controller.download(99L, response);

        verify(sysOssService).download(99L, response);
    }

    @Test
    @DisplayName("remove: should map service rows to api result")
    void removeShouldMapServiceRowsToApiResult() {
        when(sysOssService.deleteWithValidByIds(List.of(7L, 8L), true)).thenReturn(true);

        ApiResult<Void> result = controller.remove(new Long[]{7L, 8L});

        assertEquals(ApiResult.SUCCESS, result.getCode());
    }
}
