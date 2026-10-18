package cc.infoq.system.service.impl;

import cc.infoq.common.constant.SystemConstants;
import cc.infoq.common.exception.ServiceException;
import cc.infoq.common.mybatis.core.page.PageQuery;
import cc.infoq.common.mybatis.core.page.TableDataInfo;
import cc.infoq.common.service.PostService;
import cc.infoq.common.utils.MapstructUtils;
import cc.infoq.common.utils.StreamUtils;
import cc.infoq.common.utils.StringUtils;
import cc.infoq.system.domain.bo.SysPostBo;
import cc.infoq.system.domain.entity.SysPost;
import cc.infoq.system.domain.entity.SysUserPost;
import cc.infoq.system.domain.vo.SysPostVo;
import cc.infoq.system.mapper.SysDeptMapper;
import cc.infoq.system.mapper.SysPostMapper;
import cc.infoq.system.mapper.SysUserPostMapper;
import cc.infoq.system.service.SysPostService;
import cn.hutool.core.collection.CollUtil;
import cn.hutool.core.util.ObjectUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.AllArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 岗位信息 服务层处理
 *
 * @author Pontus
 */
@AllArgsConstructor
@Service
public class SysPostServiceImpl implements SysPostService, PostService {

    private final SysPostMapper sysPostMapper;
    private final SysDeptMapper sysDeptMapper;
    private final SysUserPostMapper sysUserPostMapper;

    /**
     * 分页查询岗位列表
     *
     * @param post      查询条件
     * @param pageQuery 分页参数
     * @return 岗位分页列表
     */
    @Override
    public TableDataInfo<SysPostVo> selectPagePostList(SysPostBo post, PageQuery pageQuery) {
        Page<SysPostVo> page = sysPostMapper.selectPagePostList(pageQuery.build(), buildQueryWrapper(post));
        return TableDataInfo.build(page);
    }

    /**
     * 查询岗位信息集合
     *
     * @param post 岗位信息
     * @return 岗位信息集合
     */
    @Override
    public List<SysPostVo> selectPostList(SysPostBo post) {
        return sysPostMapper.selectVoList(buildQueryWrapper(post));
    }

    /**
     * 查询用户所属岗位组
     *
     * @param userId 用户ID
     * @return 岗位ID
     */
    @Override
    public List<SysPostVo> selectPostsByUserId(Long userId) {
        return sysPostMapper.selectPostsByUserId(userId);
    }

    /**
     * 根据查询条件构建查询包装器
     *
     * @param bo 查询条件对象
     * @return 构建好的查询包装器
     */
    private LambdaQueryWrapper<SysPost> buildQueryWrapper(SysPostBo bo) {
        Map<String, Object> params = bo.getParams();
        LambdaQueryWrapper<SysPost> wrapper = new LambdaQueryWrapper<>();
        wrapper.like(StringUtils.isNotBlank(bo.getPostCode()), SysPost::getPostCode, bo.getPostCode())
            .like(StringUtils.isNotBlank(bo.getPostCategory()), SysPost::getPostCategory, bo.getPostCategory())
            .like(StringUtils.isNotBlank(bo.getPostName()), SysPost::getPostName, bo.getPostName())
            .eq(StringUtils.isNotBlank(bo.getStatus()), SysPost::getStatus, bo.getStatus())
            .between(params.get("beginTime") != null && params.get("endTime") != null,
                SysPost::getCreateTime, params.get("beginTime"), params.get("endTime"))
            .orderByAsc(SysPost::getPostSort);
        if (ObjectUtil.isNotNull(bo.getDeptId())) {
            //优先单部门搜索
            wrapper.eq(SysPost::getDeptId, bo.getDeptId());
        } else if (ObjectUtil.isNotNull(bo.getBelongDeptId())) {
            //部门树搜索
            wrapper.and(x -> {
                List<Long> deptIds = sysDeptMapper.selectDeptAndChildById(bo.getBelongDeptId());
                x.in(SysPost::getDeptId, deptIds);
            });
        }
        return wrapper;
    }

    /**
     * 查询所有岗位
     *
     * @return 岗位列表
     */
    @Override
    public List<SysPostVo> selectPostAll() {
        return sysPostMapper.selectVoList(new QueryWrapper<>());
    }

    /**
     * 通过岗位ID查询岗位信息
     *
     * @param postId 岗位ID
     * @return 角色对象信息
     */
    @Override
    public SysPostVo selectPostById(Long postId) {
        return sysPostMapper.selectVoById(postId);
    }

    /**
     * 根据用户ID获取岗位选择框列表
     *
     * @param userId 用户ID
     * @return 选中岗位ID列表
     */
    @Override
    public List<Long> selectPostListByUserId(Long userId) {
        List<SysPostVo> list = sysPostMapper.selectPostsByUserId(userId);
        return StreamUtils.toList(list, SysPostVo::getPostId);
    }

    /**
     * 通过岗位ID串查询岗位
     *
     * @param postIds 岗位id串
     * @return 岗位列表信息
     */
    @Override
    public List<SysPostVo> selectPostByIds(List<Long> postIds) {
        return sysPostMapper.selectVoList(new LambdaQueryWrapper<SysPost>()
            .select(SysPost::getPostId, SysPost::getPostName, SysPost::getPostCode)
            .eq(SysPost::getStatus, SystemConstants.NORMAL)
            .in(CollUtil.isNotEmpty(postIds), SysPost::getPostId, postIds));
    }

    /**
     * 校验岗位名称是否唯一
     *
     * @param post 岗位信息
     * @return 结果
     */
    @Override
    public boolean checkPostNameUnique(SysPostBo post) {
        boolean exist = sysPostMapper.exists(new LambdaQueryWrapper<SysPost>()
            .eq(SysPost::getPostName, post.getPostName())
            .eq(SysPost::getDeptId, post.getDeptId())
            .ne(ObjectUtil.isNotNull(post.getPostId()), SysPost::getPostId, post.getPostId()));
        return !exist;
    }

    /**
     * 校验岗位编码是否唯一
     *
     * @param post 岗位信息
     * @return 结果
     */
    @Override
    public boolean checkPostCodeUnique(SysPostBo post) {
        boolean exist = sysPostMapper.exists(new LambdaQueryWrapper<SysPost>()
            .eq(SysPost::getPostCode, post.getPostCode())
            .ne(ObjectUtil.isNotNull(post.getPostId()), SysPost::getPostId, post.getPostId()));
        return !exist;
    }

    /**
     * 通过岗位ID查询岗位使用数量
     *
     * @param postId 岗位ID
     * @return 结果
     */
    @Override
    public long countUserPostById(Long postId) {
        return sysUserPostMapper.selectCount(new LambdaQueryWrapper<SysUserPost>().eq(SysUserPost::getPostId, postId));
    }

    /**
     * 通过部门ID查询岗位使用数量
     *
     * @param deptId 部门id
     * @return 结果
     */
    @Override
    public long countPostByDeptId(Long deptId) {
        return sysPostMapper.selectCount(new LambdaQueryWrapper<SysPost>().eq(SysPost::getDeptId, deptId));
    }

    /**
     * 删除岗位信息
     *
     * @param postId 岗位ID
     * @return 结果
     */
    @Override
    public int deletePostById(Long postId) {
        return sysPostMapper.deleteById(postId);
    }

    /**
     * 批量删除岗位信息
     *
     * @param postIds 需要删除的岗位ID
     * @return 结果
     */
    @Override
    public int deletePostByIds(List<Long> postIds) {
        List<SysPost> list = sysPostMapper.selectByIds(postIds);
        Set<Long> assignedPostIds;
        if (CollUtil.isNotEmpty(list)) {
            assignedPostIds = sysUserPostMapper.selectList(new LambdaQueryWrapper<SysUserPost>()
                    .in(SysUserPost::getPostId, postIds))
                .stream()
                .map(SysUserPost::getPostId)
                .collect(Collectors.toSet());
        } else {
            assignedPostIds = Set.of();
        }
        for (SysPost post : list) {
            if (assignedPostIds.contains(post.getPostId())) {
                throw new ServiceException("{}已分配，不能删除!", post.getPostName());
            }
        }
        return sysPostMapper.deleteByIds(postIds);
    }

    /**
     * 新增保存岗位信息
     *
     * @param bo 岗位信息
     * @return 结果
     */
    @Override
    public int insertPost(SysPostBo bo) {
        SysPost post = MapstructUtils.convert(bo, SysPost.class);
        return sysPostMapper.insert(post);
    }

    /**
     * 修改保存岗位信息
     *
     * @param bo 岗位信息
     * @return 结果
     */
    @Override
    public int updatePost(SysPostBo bo) {
        SysPost post = MapstructUtils.convert(bo, SysPost.class);
        return sysPostMapper.updateById(post);
    }

    /**
     * 根据岗位 ID 列表查询岗位名称映射关系
     *
     * @param postIds 岗位 ID 列表
     * @return Map，其中 key 为岗位 ID，value 为对应的岗位名称
     */
    @Override
    public Map<Long, String> selectPostNamesByIds(List<Long> postIds) {
        if (CollUtil.isEmpty(postIds)) {
            return Collections.emptyMap();
        }
        List<SysPost> list = sysPostMapper.selectList(
            new LambdaQueryWrapper<SysPost>()
                .select(SysPost::getPostId, SysPost::getPostName)
                .in(SysPost::getPostId, postIds)
        );
        return StreamUtils.toMap(list, SysPost::getPostId, SysPost::getPostName);
    }

}
