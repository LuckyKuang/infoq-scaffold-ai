package cc.infoq.system.controller.system;

import cc.infoq.common.constant.SystemConstants;
import cc.infoq.common.domain.ApiResult;
import cc.infoq.common.excel.utils.ExcelUtil;
import cc.infoq.common.mybatis.core.page.PageQuery;
import cc.infoq.common.mybatis.core.page.TableDataInfo;
import cc.infoq.system.domain.bo.SysDeptBo;
import cc.infoq.system.domain.bo.SysPostBo;
import cc.infoq.system.domain.vo.SysPostVo;
import cc.infoq.system.service.SysDeptService;
import cc.infoq.system.service.SysPostService;
import cn.hutool.core.lang.tree.Tree;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;

import jakarta.servlet.http.HttpServletResponse;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
@Tag("dev")
class SysPostControllerTest {

    @Mock
    private SysPostService sysPostService;
    @Mock
    private SysDeptService sysDeptService;

    @InjectMocks
    private SysPostController controller;

    @Test
    @DisplayName("edit: should fail when disabling post that still has users")
    void editShouldFailWhenDisablingAssignedPost() {
        SysPostBo bo = new SysPostBo();
        bo.setPostId(10L);
        bo.setPostName("审计岗");
        bo.setStatus(SystemConstants.DISABLE);
        when(sysPostService.checkPostNameUnique(bo)).thenReturn(true);
        when(sysPostService.checkPostCodeUnique(bo)).thenReturn(true);
        when(sysPostService.countUserPostById(10L)).thenReturn(1L);

        ApiResult<Void> result = controller.edit(bo);

        assertEquals(ApiResult.FAIL, result.getCode());
        assertTrue(result.getMsg().contains("不能禁用"));
    }

    @Test
    @DisplayName("add: should fail when post code already exists")
    void addShouldFailWhenPostCodeExists() {
        SysPostBo bo = new SysPostBo();
        bo.setPostName("运维岗");
        when(sysPostService.checkPostNameUnique(bo)).thenReturn(true);
        when(sysPostService.checkPostCodeUnique(bo)).thenReturn(false);

        ApiResult<Void> result = controller.add(bo);

        assertEquals(ApiResult.FAIL, result.getCode());
        assertTrue(result.getMsg().contains("岗位编码已存在"));
    }

    @Test
    @DisplayName("add: should return success when uniqueness checks pass")
    void addShouldReturnSuccessWhenChecksPass() {
        SysPostBo bo = new SysPostBo();
        bo.setPostName("测试岗");
        when(sysPostService.checkPostNameUnique(bo)).thenReturn(true);
        when(sysPostService.checkPostCodeUnique(bo)).thenReturn(true);
        when(sysPostService.insertPost(bo)).thenReturn(1);

        ApiResult<Void> result = controller.add(bo);

        assertEquals(ApiResult.SUCCESS, result.getCode());
    }

    @Test
    @DisplayName("list/getInfo/remove: should delegate to post service")
    void listGetInfoRemoveShouldDelegate() {
        SysPostBo bo = new SysPostBo();
        PageQuery pageQuery = new PageQuery(10, 1);
        TableDataInfo<SysPostVo> page = TableDataInfo.build(List.of(new SysPostVo()));
        SysPostVo postVo = new SysPostVo();
        postVo.setPostId(5L);
        when(sysPostService.selectPagePostList(bo, pageQuery)).thenReturn(page);
        when(sysPostService.selectPostById(5L)).thenReturn(postVo);
        when(sysPostService.deletePostByIds(List.of(1L, 2L))).thenReturn(2);

        TableDataInfo<SysPostVo> listResult = controller.list(bo, pageQuery);
        ApiResult<SysPostVo> getInfoResult = controller.getInfo(5L);
        ApiResult<Void> removeResult = controller.remove(new Long[]{1L, 2L});

        assertEquals(1, listResult.getRows().size());
        assertEquals(5L, getInfoResult.getData().getPostId());
        assertEquals(ApiResult.SUCCESS, removeResult.getCode());
    }

    @Test
    @DisplayName("optionselect: should query by deptId when dept provided")
    void optionselectShouldQueryByDeptId() {
        SysPostVo postVo = new SysPostVo();
        postVo.setPostId(7L);
        when(sysPostService.selectPostList(any(SysPostBo.class))).thenReturn(List.of(postVo));

        ApiResult<List<SysPostVo>> result = controller.optionselect(null, 3L);

        assertEquals(ApiResult.SUCCESS, result.getCode());
        assertEquals(1, result.getData().size());
        verify(sysPostService).selectPostList(any(SysPostBo.class));
    }

    @Test
    @DisplayName("optionselect: should query by ids when postIds provided")
    void optionselectShouldQueryByPostIds() {
        SysPostVo postVo = new SysPostVo();
        postVo.setPostId(8L);
        when(sysPostService.selectPostByIds(List.of(8L, 9L))).thenReturn(List.of(postVo));

        ApiResult<List<SysPostVo>> result = controller.optionselect(new Long[]{8L, 9L}, null);

        assertEquals(ApiResult.SUCCESS, result.getCode());
        assertEquals(8L, result.getData().get(0).getPostId());
    }

    @Test
    @DisplayName("optionselect: should return empty list when no condition provided")
    void optionselectShouldReturnEmptyWhenNoCondition() {
        ApiResult<List<SysPostVo>> result = controller.optionselect(null, null);
        assertEquals(ApiResult.SUCCESS, result.getCode());
        assertEquals(0, result.getData().size());
    }

    @Test
    @DisplayName("deptTree: should return department tree from dept service")
    void deptTreeShouldDelegateToDeptService() {
        when(sysDeptService.selectDeptTreeList(any(SysDeptBo.class))).thenReturn(List.<Tree<Long>>of());

        ApiResult<List<Tree<Long>>> result = controller.deptTree(new SysDeptBo());

        assertEquals(ApiResult.SUCCESS, result.getCode());
        assertEquals(0, result.getData().size());
    }

    @Test
    @DisplayName("export: should call excel export utility with service result")
    void exportShouldCallExcelUtil() {
        SysPostBo bo = new SysPostBo();
        List<SysPostVo> posts = List.of(new SysPostVo());
        HttpServletResponse response = mock(HttpServletResponse.class);
        when(sysPostService.selectPostList(bo)).thenReturn(posts);

        try (MockedStatic<ExcelUtil> excelUtil = mockStatic(ExcelUtil.class)) {
            controller.export(bo, response);
            excelUtil.verify(() -> ExcelUtil.exportExcel(posts, "岗位数据", SysPostVo.class, response));
        }
    }
}
