package cc.infoq.system.service.impl;

import cc.infoq.common.exception.ServiceException;
import cc.infoq.common.mybatis.core.page.PageQuery;
import cc.infoq.common.mybatis.core.page.TableDataInfo;
import cc.infoq.common.utils.MapstructUtils;
import cc.infoq.common.utils.SpringUtils;
import cc.infoq.system.domain.bo.SysPostBo;
import cc.infoq.system.domain.entity.SysPost;
import cc.infoq.system.domain.entity.SysUserPost;
import cc.infoq.system.domain.vo.SysPostVo;
import cc.infoq.system.mapper.SysDeptMapper;
import cc.infoq.system.mapper.SysPostMapper;
import cc.infoq.system.mapper.SysUserPostMapper;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import io.github.linpeilie.Converter;
import org.apache.ibatis.builder.MapperBuilderAssistant;
import org.apache.ibatis.session.Configuration;
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
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@Tag("dev")
class SysPostServiceImplTest {

    @Mock
    private SysPostMapper sysPostMapper;
    @Mock
    private SysDeptMapper sysDeptMapper;
    @Mock
    private SysUserPostMapper sysUserPostMapper;

    @BeforeEach
    void setUp() {
        GenericApplicationContext context = new GenericApplicationContext();
        context.registerBean(Converter.class, () -> mock(Converter.class));
        context.refresh();
        new SpringUtils().setApplicationContext(context);
        if (TableInfoHelper.getTableInfo(SysPost.class) == null) {
            TableInfoHelper.initTableInfo(new MapperBuilderAssistant(new Configuration(), ""), SysPost.class);
        }
    }

    @Test
    @DisplayName("deletePostByIds: should throw when any post has assigned user")
    void deletePostByIdsShouldThrowWhenPostAssigned() {
        SysPostServiceImpl service = new SysPostServiceImpl(sysPostMapper, sysDeptMapper, sysUserPostMapper);
        SysPost post = new SysPost();
        post.setPostId(1L);
        post.setPostName("审计岗");
        when(sysPostMapper.selectByIds(List.of(1L))).thenReturn(List.of(post));
        SysUserPost userPost = new SysUserPost();
        userPost.setPostId(1L);
        when(sysUserPostMapper.selectList(any())).thenReturn(List.of(userPost));

        assertThrows(ServiceException.class, () -> service.deletePostByIds(List.of(1L)));
    }

    @Test
    @DisplayName("selectPagePostList: should apply belongDept tree filter and return page rows")
    void selectPagePostListShouldApplyBelongDeptTreeFilterAndReturnRows() {
        SysPostServiceImpl service = new SysPostServiceImpl(sysPostMapper, sysDeptMapper, sysUserPostMapper);
        SysPostBo bo = new SysPostBo();
        bo.setPostCode("DEV");
        bo.setPostName("开发");
        bo.setBelongDeptId(100L);
        bo.getParams().put("beginTime", "2026-03-01 00:00:00");
        bo.getParams().put("endTime", "2026-03-31 23:59:59");
        when(sysDeptMapper.selectDeptAndChildById(100L)).thenReturn(List.of(100L, 101L));

        SysPostVo vo = new SysPostVo();
        vo.setPostId(9L);
        vo.setPostName("开发工程师");
        Page<SysPostVo> page = new Page<>();
        page.setRecords(List.of(vo));
        page.setTotal(1);
        when(sysPostMapper.selectPagePostList(any(), any())).thenReturn(page);

        TableDataInfo<SysPostVo> result = service.selectPagePostList(bo, new PageQuery(10, 1));

        assertEquals(1, result.getTotal());
        assertEquals(1, result.getRows().size());
        assertEquals(9L, result.getRows().get(0).getPostId());
        verify(sysDeptMapper).selectDeptAndChildById(100L);
    }

    @Test
    @DisplayName("selectPostListByUserId: should map user posts to post id list")
    void selectPostListByUserIdShouldMapUserPostsToPostIdList() {
        SysPostServiceImpl service = new SysPostServiceImpl(sysPostMapper, sysDeptMapper, sysUserPostMapper);
        SysPostVo p1 = new SysPostVo();
        p1.setPostId(1L);
        SysPostVo p2 = new SysPostVo();
        p2.setPostId(2L);
        when(sysPostMapper.selectPostsByUserId(200L)).thenReturn(List.of(p1, p2));

        List<Long> ids = service.selectPostListByUserId(200L);

        assertEquals(List.of(1L, 2L), ids);
    }

    @Test
    @DisplayName("selectPostList/selectPostAll/selectPostById/selectPostsByUserId: should delegate to mapper")
    void selectPostQueryMethodsShouldDelegateToMapper() {
        SysPostServiceImpl service = new SysPostServiceImpl(sysPostMapper, sysDeptMapper, sysUserPostMapper);
        SysPostBo bo = new SysPostBo();
        bo.setDeptId(200L);
        bo.setPostName("开发");
        SysPostVo vo = new SysPostVo();
        vo.setPostId(9L);
        vo.setPostName("开发工程师");
        when(sysPostMapper.selectVoList(any())).thenReturn(List.of(vo));
        when(sysPostMapper.selectVoById(9L)).thenReturn(vo);
        when(sysPostMapper.selectPostsByUserId(66L)).thenReturn(List.of(vo));

        List<SysPostVo> byCondition = service.selectPostList(bo);
        List<SysPostVo> all = service.selectPostAll();
        SysPostVo byId = service.selectPostById(9L);
        List<SysPostVo> byUser = service.selectPostsByUserId(66L);

        assertEquals(1, byCondition.size());
        assertEquals(1, all.size());
        assertEquals(9L, byId.getPostId());
        assertEquals(1, byUser.size());
    }

    @Test
    @DisplayName("selectPostByIds: should query enabled posts by ids")
    void selectPostByIdsShouldReturnPostsFromMapper() {
        SysPostServiceImpl service = new SysPostServiceImpl(sysPostMapper, sysDeptMapper, sysUserPostMapper);
        SysPostVo vo = new SysPostVo();
        vo.setPostId(8L);
        vo.setPostName("运维");
        when(sysPostMapper.selectVoList(any())).thenReturn(List.of(vo));

        List<SysPostVo> result = service.selectPostByIds(List.of(8L));

        assertEquals(1, result.size());
        assertEquals("运维", result.get(0).getPostName());
    }

    @Test
    @DisplayName("countPostByDeptId/deletePostById: should delegate to mapper")
    void countPostByDeptIdAndDeletePostByIdShouldDelegateToMapper() {
        SysPostServiceImpl service = new SysPostServiceImpl(sysPostMapper, sysDeptMapper, sysUserPostMapper);
        when(sysPostMapper.selectCount(any())).thenReturn(3L);
        when(sysPostMapper.deleteById(100L)).thenReturn(1);

        long count = service.countPostByDeptId(20L);
        int rows = service.deletePostById(100L);

        assertEquals(3L, count);
        assertEquals(1, rows);
    }

    @Test
    @DisplayName("checkPostNameUnique/checkPostCodeUnique: should reflect mapper exists")
    void checkPostUniqueShouldReflectMapperExists() {
        SysPostServiceImpl service = new SysPostServiceImpl(sysPostMapper, sysDeptMapper, sysUserPostMapper);
        SysPostBo bo = new SysPostBo();
        bo.setPostId(10L);
        bo.setDeptId(20L);
        bo.setPostName("开发岗");
        bo.setPostCode("DEV");

        when(sysPostMapper.exists(any())).thenReturn(true).thenReturn(false);

        assertFalse(service.checkPostNameUnique(bo));
        assertTrue(service.checkPostCodeUnique(bo));
    }

    @Test
    @DisplayName("selectPostNamesByIds: should return empty map for empty ids")
    void selectPostNamesByIdsShouldReturnEmptyMapForEmptyIds() {
        SysPostServiceImpl service = new SysPostServiceImpl(sysPostMapper, sysDeptMapper, sysUserPostMapper);

        Map<Long, String> result = service.selectPostNamesByIds(List.of());

        assertTrue(result.isEmpty());
    }

    @Test
    @DisplayName("deletePostByIds: should delete when posts are not assigned")
    void deletePostByIdsShouldDeleteWhenNoAssignment() {
        SysPostServiceImpl service = new SysPostServiceImpl(sysPostMapper, sysDeptMapper, sysUserPostMapper);
        SysPost post = new SysPost();
        post.setPostId(7L);
        post.setPostName("测试岗");
        when(sysPostMapper.selectByIds(List.of(7L))).thenReturn(List.of(post));
        when(sysUserPostMapper.selectList(any())).thenReturn(List.of());
        when(sysPostMapper.deleteByIds(List.of(7L))).thenReturn(1);

        int rows = service.deletePostByIds(List.of(7L));

        assertEquals(1, rows);
    }

    @Test
    @DisplayName("insertPost/updatePost: should convert bo and persist")
    void insertAndUpdatePostShouldConvertBoAndPersist() {
        SysPostServiceImpl service = new SysPostServiceImpl(sysPostMapper, sysDeptMapper, sysUserPostMapper);
        SysPostBo bo = new SysPostBo();
        bo.setPostId(18L);
        bo.setPostName("平台岗");
        SysPost converted = new SysPost();
        converted.setPostId(18L);
        converted.setPostName("平台岗");
        when(sysPostMapper.insert(converted)).thenReturn(1);
        when(sysPostMapper.updateById(converted)).thenReturn(1);

        try (MockedStatic<MapstructUtils> mapstructUtils = mockStatic(MapstructUtils.class)) {
            mapstructUtils.when(() -> MapstructUtils.convert(bo, SysPost.class)).thenReturn(converted);

            int insertRows = service.insertPost(bo);
            int updateRows = service.updatePost(bo);

            assertEquals(1, insertRows);
            assertEquals(1, updateRows);
            verify(sysPostMapper).insert(converted);
            verify(sysPostMapper).updateById(converted);
        }
    }
}
