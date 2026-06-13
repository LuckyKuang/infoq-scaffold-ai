package cc.infoq.system.service.impl;

import cc.infoq.common.domain.dto.OssDTO;
import cc.infoq.common.exception.ServiceException;
import cc.infoq.common.mybatis.core.page.PageQuery;
import cc.infoq.common.mybatis.core.page.TableDataInfo;
import cc.infoq.common.oss.core.OssClient;
import cc.infoq.common.oss.entity.UploadResult;
import cc.infoq.common.oss.enums.AccessPolicyType;
import cc.infoq.common.oss.factory.OssFactory;
import cc.infoq.common.utils.MapstructUtils;
import cc.infoq.common.utils.SpringUtils;
import cc.infoq.system.domain.bo.SysOssBo;
import cc.infoq.system.domain.entity.SysOss;
import cc.infoq.system.domain.vo.SysOssVo;
import cc.infoq.system.mapper.SysOssMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.linpeilie.Converter;
import jakarta.servlet.ServletOutputStream;
import jakarta.servlet.WriteListener;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.redisson.api.RedissonClient;
import org.springframework.context.support.GenericApplicationContext;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@Tag("dev")
class SysOssServiceImplTest {

    @Mock
    private SysOssMapper sysOssMapper;

    @Mock
    private MultipartFile file;
    @Captor
    private ArgumentCaptor<LambdaQueryWrapper<SysOss>> wrapperCaptor;

    @BeforeAll
    static void initSpringContext() {
        GenericApplicationContext context = new GenericApplicationContext();
        context.registerBean(Converter.class, () -> mock(Converter.class));
        context.registerBean(ObjectMapper.class, () -> new ObjectMapper());
        context.registerBean(RedissonClient.class, () -> mock(RedissonClient.class));
        context.refresh();
        new SpringUtils().setApplicationContext(context);
    }

    @Test
    @DisplayName("upload: should throw when multipart file is empty")
    void uploadShouldThrowWhenMultipartFileEmpty() {
        SysOssServiceImpl service = new SysOssServiceImpl(sysOssMapper);
        when(file.isEmpty()).thenReturn(true);

        assertThrows(ServiceException.class, () -> service.upload(file));
    }

    @Test
    @DisplayName("queryPageList: should build query wrapper with non-empty filters")
    void queryPageListShouldBuildQueryWrapperWithFilters() {
        SysOssServiceImpl service = new SysOssServiceImpl(sysOssMapper);
        SysOssBo bo = new SysOssBo();
        bo.setFileName("demo");
        bo.setOriginalName("origin");
        bo.setFileSuffix(".png");
        bo.setUrl("https://example.com/a.png");
        bo.setCreateBy(1L);
        bo.setService("local");
        bo.getParams().put("beginCreateTime", "2026-03-01 00:00:00");
        bo.getParams().put("endCreateTime", "2026-03-31 23:59:59");

        Page<SysOssVo> page = new Page<>();
        page.setRecords(List.of());
        page.setTotal(0);
        when(sysOssMapper.selectVoPage(any(), any())).thenReturn(page);

        TableDataInfo<SysOssVo> result = service.queryPageList(bo, new PageQuery(10, 1));

        assertEquals(0, result.getRows().size());
        verify(sysOssMapper).selectVoPage(any(), wrapperCaptor.capture());
        assertTrue(wrapperCaptor.getValue() != null);
    }

    @Test
    @DisplayName("queryPageList: should rewrite private url to presigned url")
    void queryPageListShouldRewritePrivateUrl() {
        SysOssServiceImpl service = new SysOssServiceImpl(sysOssMapper);
        SysOssBo bo = new SysOssBo();
        SysOssVo row = new SysOssVo();
        row.setOssId(1L);
        row.setService("local");
        row.setFileName("path/a.txt");
        row.setUrl("https://old-url");
        Page<SysOssVo> page = new Page<>();
        page.setRecords(List.of(row));
        page.setTotal(1);
        when(sysOssMapper.selectVoPage(any(), any())).thenReturn(page);

        OssClient storage = mock(OssClient.class);
        when(storage.getAccessPolicy()).thenReturn(AccessPolicyType.PRIVATE);
        when(storage.createPresignedGetUrl("path/a.txt", java.time.Duration.ofSeconds(120))).thenReturn("https://temp-url");
        try (MockedStatic<OssFactory> ossFactory = mockStatic(OssFactory.class)) {
            ossFactory.when(() -> OssFactory.instance("local")).thenReturn(storage);

            TableDataInfo<SysOssVo> result = service.queryPageList(bo, new PageQuery(1, 10));

            assertEquals(1, result.getRows().size());
            assertEquals("https://temp-url", result.getRows().get(0).getUrl());
        }
    }

    @Test
    @DisplayName("listByIds/selectUrlByIds/selectByIds: should fail explicitly when matching url fails")
    void listAndSelectByIdsShouldFailWhenMatchingUrlFails() {
        SysOssServiceImpl service = new SysOssServiceImpl(sysOssMapper);

        SysOssVo vo1 = buildVo(1L, "local", "a.txt", "https://origin/a");
        when(sysOssMapper.selectVoByIds(List.of(1L))).thenReturn(List.of(vo1));

        OssClient storage = mock(OssClient.class);
        when(storage.getAccessPolicy()).thenReturn(AccessPolicyType.PRIVATE);
        when(storage.createPresignedGetUrl(any(), any())).thenThrow(new RuntimeException("storage unavailable"));

        try (MockedStatic<OssFactory> ossFactory = mockStatic(OssFactory.class)) {
            ossFactory.when(() -> OssFactory.instance("local")).thenReturn(storage);

            assertThrows(ServiceException.class, () -> service.listByIds(List.of(1L)));
            assertThrows(ServiceException.class, () -> service.selectUrlByIds("1"));
            assertThrows(ServiceException.class, () -> service.selectByIds("1"));
        }
    }

    @Test
    @DisplayName("listByIds/selectUrlByIds/selectByIds: should batch load and preserve requested order")
    void listAndSelectByIdsShouldBatchLoadAndPreserveRequestedOrder() {
        SysOssServiceImpl service = new SysOssServiceImpl(sysOssMapper);
        List<Long> ids = List.of(2L, 1L, 2L);
        SysOssVo vo1 = buildVo(1L, "local", "a.txt", "https://origin/a");
        SysOssVo vo2 = buildVo(2L, "local", "b.txt", "https://origin/b");
        when(sysOssMapper.selectVoByIds(ids)).thenReturn(List.of(vo1, vo2));

        OssClient storage = mock(OssClient.class);
        when(storage.getAccessPolicy()).thenReturn(AccessPolicyType.PUBLIC);

        try (MockedStatic<OssFactory> ossFactory = mockStatic(OssFactory.class)) {
            ossFactory.when(() -> OssFactory.instance("local")).thenReturn(storage);

            List<SysOssVo> rows = service.listByIds(ids);
            String urls = service.selectUrlByIds("2,1,2");
            List<OssDTO> dtoList = service.selectByIds("2,1,2");

            assertEquals(List.of(2L, 1L, 2L), rows.stream().map(SysOssVo::getOssId).toList());
            assertEquals("https://origin/b,https://origin/a,https://origin/b", urls);
            assertEquals(List.of("https://origin/b", "https://origin/a", "https://origin/b"),
                dtoList.stream().map(OssDTO::getUrl).toList());
        }
    }

    @Test
    @DisplayName("download: should throw when oss record missing")
    void downloadShouldThrowWhenRecordMissing() {
        SysOssServiceImpl service = new SysOssServiceImpl(sysOssMapper);
        SysOssServiceImpl proxy = org.mockito.Mockito.spy(service);
        HttpServletResponse response = mock(HttpServletResponse.class);
        try (MockedStatic<SpringUtils> springUtils = mockStatic(SpringUtils.class)) {
            springUtils.when(() -> SpringUtils.getAopProxy(service)).thenReturn(proxy);
            when(proxy.getById(1L)).thenReturn(null);

            ServiceException ex = assertThrows(ServiceException.class, () -> service.download(1L, response));
            assertTrue(ex.getMessage().contains("文件数据不存在"));
        }
    }

    @Test
    @DisplayName("download: should set response and delegate to oss storage")
    void downloadShouldDelegateToStorage() throws IOException {
        SysOssServiceImpl service = new SysOssServiceImpl(sysOssMapper);
        SysOssServiceImpl proxy = org.mockito.Mockito.spy(service);
        HttpServletResponse response = mock(HttpServletResponse.class);
        ServletOutputStream outputStream = new InMemoryServletOutputStream();
        when(response.getOutputStream()).thenReturn(outputStream);
        SysOssVo vo = buildVo(9L, "local", "oss/file.txt", "https://origin/file");
        vo.setOriginalName("报告.txt");
        OssClient storage = mock(OssClient.class);

        try (MockedStatic<SpringUtils> springUtils = mockStatic(SpringUtils.class);
             MockedStatic<OssFactory> ossFactory = mockStatic(OssFactory.class)) {
            springUtils.when(() -> SpringUtils.getAopProxy(service)).thenReturn(proxy);
            when(proxy.getById(9L)).thenReturn(vo);
            ossFactory.when(() -> OssFactory.instance("local")).thenReturn(storage);

            service.download(9L, response);

            verify(response).setContentType("application/octet-stream; charset=UTF-8");
            verify(storage).download(eq("oss/file.txt"), any(), any());
        }
    }

    @Test
    @DisplayName("upload(multipart): should throw when original file name missing")
    void uploadMultipartShouldThrowWhenFileNameMissing() {
        SysOssServiceImpl service = new SysOssServiceImpl(sysOssMapper);
        when(file.isEmpty()).thenReturn(false);
        when(file.getOriginalFilename()).thenReturn(null);

        ServiceException ex = assertThrows(ServiceException.class, () -> service.upload(file));

        assertTrue(ex.getMessage().contains("文件名不能为空"));
    }

    @Test
    @DisplayName("upload(multipart): should throw service exception when bytes read fails")
    void uploadMultipartShouldThrowWhenReadBytesFails() throws IOException {
        SysOssServiceImpl service = new SysOssServiceImpl(sysOssMapper);
        when(file.isEmpty()).thenReturn(false);
        when(file.getOriginalFilename()).thenReturn("avatar.png");
        when(file.getBytes()).thenThrow(new IOException("read fail"));
        OssClient storage = mock(OssClient.class);
        try (MockedStatic<OssFactory> ossFactory = mockStatic(OssFactory.class)) {
            ossFactory.when(OssFactory::instance).thenReturn(storage);
            ServiceException ex = assertThrows(ServiceException.class, () -> service.upload(file));
            assertTrue(ex.getMessage().contains("read fail"));
        }
    }

    @Test
    @DisplayName("upload(multipart): should save metadata and return converted vo")
    void uploadMultipartShouldPersistAndReturnVo() throws IOException {
        SysOssServiceImpl service = new SysOssServiceImpl(sysOssMapper);
        when(file.isEmpty()).thenReturn(false);
        when(file.getOriginalFilename()).thenReturn("avatar.png");
        when(file.getContentType()).thenReturn("image/png");
        when(file.getSize()).thenReturn(12L);
        when(file.getBytes()).thenReturn("binary-content".getBytes(StandardCharsets.UTF_8));

        UploadResult uploadResult = UploadResult.builder()
            .url("https://bucket/avatar.png")
            .filename("avatar.png")
            .eTag("etag")
            .build();
        OssClient storage = mock(OssClient.class);
        when(storage.uploadSuffix(any(byte[].class), eq(".png"), eq("image/png"))).thenReturn(uploadResult);
        when(storage.getConfigKey()).thenReturn("local");
        when(storage.getAccessPolicy()).thenReturn(AccessPolicyType.PUBLIC);
        when(sysOssMapper.insert(any(SysOss.class))).thenReturn(1);
        try (MockedStatic<OssFactory> ossFactory = mockStatic(OssFactory.class);
             MockedStatic<MapstructUtils> mapstructUtils = mockStatic(MapstructUtils.class)) {
            ossFactory.when(OssFactory::instance).thenReturn(storage);
            ossFactory.when(() -> OssFactory.instance("local")).thenReturn(storage);
            mapstructUtils.when(() -> MapstructUtils.convert(any(SysOss.class), eq(SysOssVo.class)))
                .thenAnswer(invocation -> {
                    SysOss entity = invocation.getArgument(0);
                    return buildVo(1L, entity.getService(), entity.getFileName(), entity.getUrl());
                });

            SysOssVo result = service.upload(file);

            assertEquals("avatar.png", result.getFileName());
            assertEquals("https://bucket/avatar.png", result.getUrl());
            verify(sysOssMapper).insert(any(SysOss.class));
        }
    }

    @Test
    @DisplayName("upload(file): should save metadata and return converted vo")
    void uploadFileShouldPersistAndReturnVo() throws IOException {
        SysOssServiceImpl service = new SysOssServiceImpl(sysOssMapper);
        File tempFile = File.createTempFile("oss-test-", ".txt");
        Files.writeString(tempFile.toPath(), "hello");

        UploadResult uploadResult = UploadResult.builder()
            .url("https://bucket/upload.txt")
            .filename("upload.txt")
            .eTag("etag2")
            .build();
        OssClient storage = mock(OssClient.class);
        when(storage.uploadSuffix(eq(tempFile), eq(".txt"))).thenReturn(uploadResult);
        when(storage.getConfigKey()).thenReturn("local");
        when(storage.getAccessPolicy()).thenReturn(AccessPolicyType.PUBLIC);
        when(sysOssMapper.insert(any(SysOss.class))).thenReturn(1);
        try (MockedStatic<OssFactory> ossFactory = mockStatic(OssFactory.class);
             MockedStatic<MapstructUtils> mapstructUtils = mockStatic(MapstructUtils.class)) {
            ossFactory.when(OssFactory::instance).thenReturn(storage);
            ossFactory.when(() -> OssFactory.instance("local")).thenReturn(storage);
            mapstructUtils.when(() -> MapstructUtils.convert(any(SysOss.class), eq(SysOssVo.class)))
                .thenAnswer(invocation -> {
                    SysOss entity = invocation.getArgument(0);
                    return buildVo(2L, entity.getService(), entity.getFileName(), entity.getUrl());
                });

            SysOssVo result = service.upload(tempFile);

            assertEquals("upload.txt", result.getFileName());
            assertEquals("https://bucket/upload.txt", result.getUrl());
        } finally {
            tempFile.delete();
        }
    }

    @Test
    @DisplayName("getById: should delegate to mapper")
    void getByIdShouldDelegateToMapper() {
        SysOssServiceImpl service = new SysOssServiceImpl(sysOssMapper);
        SysOssVo vo = buildVo(15L, "local", "demo.txt", "https://x/demo");
        when(sysOssMapper.selectVoById(15L)).thenReturn(vo);

        SysOssVo result = service.getById(15L);

        assertEquals(15L, result.getOssId());
        assertEquals("demo.txt", result.getFileName());
    }

    @Test
    @DisplayName("deleteWithValidByIds: should delete objects from storage and db")
    void deleteWithValidByIdsShouldDeleteStorageAndDb() {
        SysOssServiceImpl service = new SysOssServiceImpl(sysOssMapper);
        SysOss oss = new SysOss();
        oss.setService("local");
        oss.setUrl("https://example.com/old-file");
        when(sysOssMapper.selectByIds(List.of(1L))).thenReturn(List.of(oss));
        when(sysOssMapper.deleteByIds(List.of(1L))).thenReturn(1);

        OssClient ossClient = mock(OssClient.class);
        doNothing().when(ossClient).delete("https://example.com/old-file");
        try (MockedStatic<OssFactory> ossFactory = mockStatic(OssFactory.class)) {
            ossFactory.when(() -> OssFactory.instance("local")).thenReturn(ossClient);

            Boolean result = service.deleteWithValidByIds(List.of(1L), true);

            assertTrue(result);
            verify(ossClient).delete("https://example.com/old-file");
        }
    }

    @Test
    @DisplayName("deleteWithValidByIds: should return false when mapper delete count is zero")
    void deleteWithValidByIdsShouldReturnFalseWhenDeleteCountIsZero() {
        SysOssServiceImpl service = new SysOssServiceImpl(sysOssMapper);
        SysOss oss = new SysOss();
        oss.setService("local");
        oss.setUrl("https://example.com/old-file");
        when(sysOssMapper.selectByIds(List.of(1L))).thenReturn(List.of(oss));
        when(sysOssMapper.deleteByIds(List.of(1L))).thenReturn(0);

        OssClient ossClient = mock(OssClient.class);
        doNothing().when(ossClient).delete(any());
        try (MockedStatic<OssFactory> ossFactory = mockStatic(OssFactory.class)) {
            ossFactory.when(() -> OssFactory.instance("local")).thenReturn(ossClient);

            Boolean result = service.deleteWithValidByIds(List.of(1L), false);

            assertFalse(result);
        }
    }

    private static SysOssVo buildVo(Long id, String service, String fileName, String url) {
        SysOssVo vo = new SysOssVo();
        vo.setOssId(id);
        vo.setService(service);
        vo.setFileName(fileName);
        vo.setUrl(url);
        return vo;
    }

    private static class InMemoryServletOutputStream extends ServletOutputStream {
        @Override
        public boolean isReady() {
            return true;
        }

        @Override
        public void setWriteListener(WriteListener writeListener) {
            // no-op for unit tests
        }

        @Override
        public void write(int b) {
            // no-op for unit tests
        }
    }
}
