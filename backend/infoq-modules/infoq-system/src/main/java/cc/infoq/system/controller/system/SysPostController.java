package cc.infoq.system.controller.system;

import cc.infoq.common.constant.SystemConstants;
import cc.infoq.common.domain.ApiResult;
import cc.infoq.common.excel.utils.ExcelUtil;
import cc.infoq.common.log.annotation.Log;
import cc.infoq.common.log.enums.BusinessType;
import cc.infoq.common.mybatis.core.page.PageQuery;
import cc.infoq.common.mybatis.core.page.TableDataInfo;
import cc.infoq.common.redis.annotation.RepeatSubmit;
import cc.infoq.common.web.core.BaseController;
import cc.infoq.system.domain.bo.SysDeptBo;
import cc.infoq.system.domain.bo.SysPostBo;
import cc.infoq.system.domain.vo.SysPostVo;
import cc.infoq.system.service.SysDeptService;
import cc.infoq.system.service.SysPostService;
import cn.hutool.core.lang.tree.Tree;
import cn.hutool.core.util.ObjectUtil;
import jakarta.servlet.http.HttpServletResponse;
import lombok.AllArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * 岗位信息操作处理
 *
 * @author Pontus
 */
@Validated
@AllArgsConstructor
@RestController
@RequestMapping("/system/post")
public class SysPostController extends BaseController {

    private final SysPostService sysPostService;
    private final SysDeptService sysDeptService;

    /**
     * 获取岗位列表
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:post:list')")
    @GetMapping("/list")
    public TableDataInfo<SysPostVo> list(SysPostBo post, PageQuery pageQuery) {
        return sysPostService.selectPagePostList(post, pageQuery);
    }

    /**
     * 导出岗位列表
     */
    @Log(title = "岗位管理", businessType = BusinessType.EXPORT)
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:post:export')")
    @PostMapping("/export")
    public void export(SysPostBo post, HttpServletResponse response) {
        List<SysPostVo> list = sysPostService.selectPostList(post);
        ExcelUtil.exportExcel(list, "岗位数据", SysPostVo.class, response);
    }

    /**
     * 根据岗位编号获取详细信息
     *
     * @param postId 岗位ID
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:post:query')")
    @GetMapping(value = "/{postId}")
    public ApiResult<SysPostVo> getInfo(@PathVariable Long postId) {
        return ApiResult.ok(sysPostService.selectPostById(postId));
    }

    /**
     * 新增岗位
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:post:add')")
    @Log(title = "岗位管理", businessType = BusinessType.INSERT)
    @RepeatSubmit()
    @PostMapping
    public ApiResult<Void> add(@Validated @RequestBody SysPostBo post) {
        if (!sysPostService.checkPostNameUnique(post)) {
            return ApiResult.fail("新增岗位'" + post.getPostName() + "'失败，岗位名称已存在");
        } else if (!sysPostService.checkPostCodeUnique(post)) {
            return ApiResult.fail("新增岗位'" + post.getPostName() + "'失败，岗位编码已存在");
        }
        return toAjax(sysPostService.insertPost(post));
    }

    /**
     * 修改岗位
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:post:edit')")
    @Log(title = "岗位管理", businessType = BusinessType.UPDATE)
    @RepeatSubmit()
    @PutMapping
    public ApiResult<Void> edit(@Validated @RequestBody SysPostBo post) {
        if (!sysPostService.checkPostNameUnique(post)) {
            return ApiResult.fail("修改岗位'" + post.getPostName() + "'失败，岗位名称已存在");
        } else if (!sysPostService.checkPostCodeUnique(post)) {
            return ApiResult.fail("修改岗位'" + post.getPostName() + "'失败，岗位编码已存在");
        } else if (SystemConstants.DISABLE.equals(post.getStatus())
            && sysPostService.countUserPostById(post.getPostId()) > 0) {
            return ApiResult.fail("该岗位下存在已分配用户，不能禁用!");
        }
        return toAjax(sysPostService.updatePost(post));
    }

    /**
     * 删除岗位
     *
     * @param postIds 岗位ID串
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:post:remove')")
    @Log(title = "岗位管理", businessType = BusinessType.DELETE)
    @DeleteMapping("/{postIds}")
    public ApiResult<Void> remove(@PathVariable Long[] postIds) {
        return toAjax(sysPostService.deletePostByIds(Arrays.asList(postIds)));
    }

    /**
     * 获取岗位选择框列表
     *
     * @param postIds 岗位ID串
     * @param deptId  部门id
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:post:query')")
    @GetMapping("/optionselect")
    public ApiResult<List<SysPostVo>> optionselect(@RequestParam(required = false) Long[] postIds, @RequestParam(required = false) Long deptId) {
        List<SysPostVo> list = new ArrayList<>();
        if (ObjectUtil.isNotNull(deptId)) {
            SysPostBo post = new SysPostBo();
            post.setDeptId(deptId);
            list = sysPostService.selectPostList(post);
        } else if (postIds != null) {
            list = sysPostService.selectPostByIds(List.of(postIds));
        }
        return ApiResult.ok(list);
    }

    /**
     * 获取部门树列表
     */
    @PreAuthorize("@securityAuthorizationService.hasPermission('system:post:list')")
    @GetMapping("/deptTree")
    public ApiResult<List<Tree<Long>>> deptTree(SysDeptBo dept) {
        return ApiResult.ok(sysDeptService.selectDeptTreeList(dept));
    }


}
