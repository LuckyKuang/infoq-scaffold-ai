package cc.infoq.system.controller.system;

import cc.infoq.common.constant.HttpStatus;
import cc.infoq.common.constant.SystemConstants;
import cc.infoq.common.domain.ApiResult;
import cc.infoq.system.domain.bo.SysDeptBo;
import cc.infoq.system.domain.vo.SysDeptVo;
import cc.infoq.system.service.SysDeptService;
import cc.infoq.system.service.SysPostService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@Tag("dev")
class SysDeptControllerTest {

    @Mock
    private SysDeptService sysDeptService;
    @Mock
    private SysPostService sysPostService;

    @InjectMocks
    private SysDeptController controller;

    @Test
    @DisplayName("list: should return dept list from service")
    void listShouldReturnDeptListFromService() {
        SysDeptBo bo = new SysDeptBo();
        SysDeptVo vo = new SysDeptVo();
        vo.setDeptId(1L);
        when(sysDeptService.selectDeptList(bo)).thenReturn(List.of(vo));

        ApiResult<List<SysDeptVo>> result = controller.list(bo);

        assertEquals(ApiResult.SUCCESS, result.getCode());
        assertEquals(1, result.getData().size());
    }

    @Test
    @DisplayName("excludeChild: should exclude current dept and descendants")
    void excludeChildShouldExcludeCurrentDeptAndDescendants() {
        SysDeptVo self = new SysDeptVo();
        self.setDeptId(10L);
        self.setAncestors("0");
        SysDeptVo child = new SysDeptVo();
        child.setDeptId(11L);
        child.setAncestors("0,10");
        SysDeptVo other = new SysDeptVo();
        other.setDeptId(20L);
        other.setAncestors("0,2");
        when(sysDeptService.selectDeptList(org.mockito.ArgumentMatchers.any(SysDeptBo.class)))
            .thenReturn(new ArrayList<>(List.of(self, child, other)));

        ApiResult<List<SysDeptVo>> result = controller.excludeChild(10L);

        assertEquals(ApiResult.SUCCESS, result.getCode());
        assertEquals(1, result.getData().size());
        assertEquals(20L, result.getData().get(0).getDeptId());
    }

    @Test
    @DisplayName("getInfo: should check data scope and return dept detail")
    void getInfoShouldCheckDataScopeAndReturnDeptDetail() {
        SysDeptVo detail = new SysDeptVo();
        detail.setDeptId(9L);
        when(sysDeptService.selectDeptById(9L)).thenReturn(detail);

        ApiResult<SysDeptVo> result = controller.getInfo(9L);

        assertEquals(ApiResult.SUCCESS, result.getCode());
        assertEquals(9L, result.getData().getDeptId());
        verify(sysDeptService).checkDeptDataScope(9L);
    }

    @Test
    @DisplayName("add: should fail when dept name already exists")
    void addShouldFailWhenDeptNameDuplicated() {
        SysDeptBo bo = new SysDeptBo();
        bo.setDeptName("研发部");
        when(sysDeptService.checkDeptNameUnique(bo)).thenReturn(false);

        ApiResult<Void> result = controller.add(bo);

        assertEquals(ApiResult.FAIL, result.getCode());
        assertTrue(result.getMsg().contains("部门名称已存在"));
    }

    @Test
    @DisplayName("add: should return success when dept inserted")
    void addShouldReturnSuccessWhenDeptInserted() {
        SysDeptBo bo = new SysDeptBo();
        bo.setDeptName("研发部");
        when(sysDeptService.checkDeptNameUnique(bo)).thenReturn(true);
        when(sysDeptService.insertDept(bo)).thenReturn(1);

        ApiResult<Void> result = controller.add(bo);

        assertEquals(ApiResult.SUCCESS, result.getCode());
    }

    @Test
    @DisplayName("remove: should warn when deleting default dept")
    void removeShouldWarnForDefaultDept() {
        ApiResult<Void> result = controller.remove(SystemConstants.DEFAULT_DEPT_ID);

        assertEquals(HttpStatus.WARN, result.getCode());
        assertTrue(result.getMsg().contains("默认部门"));
    }

    @Test
    @DisplayName("remove: should return success when no dependency exists")
    void removeShouldReturnSuccessWhenNoDependencyExists() {
        when(sysDeptService.hasChildByDeptId(66L)).thenReturn(false);
        when(sysDeptService.checkDeptExistUser(66L)).thenReturn(false);
        when(sysPostService.countPostByDeptId(66L)).thenReturn(0L);
        when(sysDeptService.deleteDeptById(66L)).thenReturn(1);

        ApiResult<Void> result = controller.remove(66L);

        assertEquals(ApiResult.SUCCESS, result.getCode());
        verify(sysDeptService).checkDeptDataScope(66L);
    }

    @Test
    @DisplayName("edit: should fail when parent dept equals self")
    void editShouldFailWhenParentIsSelf() {
        SysDeptBo bo = new SysDeptBo();
        bo.setDeptId(9L);
        bo.setParentId(9L);
        bo.setDeptName("研发部");
        when(sysDeptService.checkDeptNameUnique(bo)).thenReturn(true);

        ApiResult<Void> result = controller.edit(bo);

        assertEquals(ApiResult.FAIL, result.getCode());
        assertTrue(result.getMsg().contains("上级部门不能是自己"));
    }

    @Test
    @DisplayName("edit: should fail when disabling dept that still has active children")
    void editShouldFailWhenDisableDeptHasActiveChildren() {
        SysDeptBo bo = new SysDeptBo();
        bo.setDeptId(10L);
        bo.setParentId(1L);
        bo.setDeptName("运营部");
        bo.setStatus(SystemConstants.DISABLE);
        when(sysDeptService.checkDeptNameUnique(bo)).thenReturn(true);
        when(sysDeptService.selectNormalChildrenDeptById(10L)).thenReturn(1L);

        ApiResult<Void> result = controller.edit(bo);

        assertEquals(ApiResult.FAIL, result.getCode());
        assertTrue(result.getMsg().contains("未停用的子部门"));
    }

    @Test
    @DisplayName("edit: should return success when validations pass")
    void editShouldReturnSuccessWhenValidationsPass() {
        SysDeptBo bo = new SysDeptBo();
        bo.setDeptId(11L);
        bo.setParentId(1L);
        bo.setDeptName("产品部");
        bo.setStatus(SystemConstants.NORMAL);
        when(sysDeptService.checkDeptNameUnique(bo)).thenReturn(true);
        when(sysDeptService.updateDept(bo)).thenReturn(1);

        ApiResult<Void> result = controller.edit(bo);

        assertEquals(ApiResult.SUCCESS, result.getCode());
        verify(sysDeptService).checkDeptDataScope(11L);
        verify(sysDeptService).updateDept(bo);
    }

    @Test
    @DisplayName("optionselect: should pass null when no ids provided")
    void optionselectShouldPassNullWhenNoIdsProvided() {
        SysDeptVo vo = new SysDeptVo();
        vo.setDeptId(7L);
        when(sysDeptService.selectDeptByIds(null)).thenReturn(List.of(vo));

        ApiResult<List<SysDeptVo>> result = controller.optionselect(null);

        assertEquals(ApiResult.SUCCESS, result.getCode());
        assertEquals(1, result.getData().size());
    }
}
