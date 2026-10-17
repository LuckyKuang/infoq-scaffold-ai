package cc.infoq.system.controller.monitor;

import cc.infoq.common.domain.ApiResult;
import cc.infoq.common.excel.utils.ExcelUtil;
import cc.infoq.common.mybatis.core.page.PageQuery;
import cc.infoq.common.mybatis.core.page.TableDataInfo;
import cc.infoq.common.redis.utils.RedisUtils;
import cc.infoq.common.utils.SpringUtils;
import cc.infoq.system.domain.bo.SysLoginInfoBo;
import cc.infoq.system.domain.vo.SysLoginInfoVo;
import cc.infoq.system.service.SysLoginInfoService;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.redisson.api.RedissonClient;
import org.springframework.context.support.GenericApplicationContext;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@Tag("dev")
class SysLoginInfoControllerTest {

    @Mock
    private SysLoginInfoService loginInfoService;

    @InjectMocks
    private SysLoginInfoController controller;

    @BeforeEach
    void initSpringContext() {
        GenericApplicationContext context = new GenericApplicationContext();
        context.registerBean(RedissonClient.class, () -> org.mockito.Mockito.mock(RedissonClient.class));
        context.refresh();
        new SpringUtils().setApplicationContext(context);
    }

    @Test
    @DisplayName("list: should return table data from service")
    void listShouldReturnServiceData() {
        SysLoginInfoBo bo = new SysLoginInfoBo();
        PageQuery pageQuery = new PageQuery(10, 1);
        TableDataInfo<SysLoginInfoVo> table = TableDataInfo.build(List.of(new SysLoginInfoVo()));
        when(loginInfoService.selectPageLoginInfoList(bo, pageQuery)).thenReturn(table);

        TableDataInfo<SysLoginInfoVo> result = controller.list(bo, pageQuery);

        assertEquals(1L, result.getTotal());
    }

    @Test
    @DisplayName("remove: should map deleted rows to success")
    void removeShouldMapDeletedRowsToSuccess() {
        when(loginInfoService.deleteLoginInfoByIds(org.mockito.ArgumentMatchers.any(Long[].class))).thenReturn(2);

        ApiResult<Void> result = controller.remove(new Long[]{1L, 2L});

        assertEquals(ApiResult.SUCCESS, result.getCode());
    }

    @Test
    @DisplayName("export: should delegate data query and call excel util")
    void exportShouldDelegateDataQueryAndCallExcelUtil() {
        SysLoginInfoBo bo = new SysLoginInfoBo();
        List<SysLoginInfoVo> rows = List.of(new SysLoginInfoVo());
        HttpServletResponse response = org.mockito.Mockito.mock(HttpServletResponse.class);
        when(loginInfoService.selectLoginInfoList(bo)).thenReturn(rows);

        try (MockedStatic<ExcelUtil> excelUtil = mockStatic(ExcelUtil.class)) {
            controller.export(bo, response);
            excelUtil.verify(() -> ExcelUtil.exportExcel(rows, "登录日志", SysLoginInfoVo.class, response));
        }
    }

    @Test
    @DisplayName("clean: should invoke service and return success")
    void cleanShouldInvokeService() {
        ApiResult<Void> result = controller.clean();

        assertEquals(ApiResult.SUCCESS, result.getCode());
        verify(loginInfoService).cleanLoginInfo();
    }

    @Test
    @DisplayName("unlock: should delete redis key when exists")
    void unlockShouldDeleteRedisKeyWhenExists() {
        try (MockedStatic<RedisUtils> redisUtils = mockStatic(RedisUtils.class)) {
            redisUtils.when(() -> RedisUtils.hasKey("pwd_err_cnt:alice")).thenReturn(true);

            ApiResult<Void> result = controller.unlock("alice");

            assertEquals(ApiResult.SUCCESS, result.getCode());
            redisUtils.verify(() -> RedisUtils.deleteObject("pwd_err_cnt:alice"));
        }
    }

    @Test
    @DisplayName("unlock: should skip delete when key not exists")
    void unlockShouldSkipDeleteWhenKeyNotExists() {
        try (MockedStatic<RedisUtils> redisUtils = mockStatic(RedisUtils.class)) {
            redisUtils.when(() -> RedisUtils.hasKey("pwd_err_cnt:bob")).thenReturn(false);

            ApiResult<Void> result = controller.unlock("bob");

            assertEquals(ApiResult.SUCCESS, result.getCode());
            redisUtils.verify(() -> RedisUtils.deleteObject("pwd_err_cnt:bob"), org.mockito.Mockito.never());
        }
    }
}
