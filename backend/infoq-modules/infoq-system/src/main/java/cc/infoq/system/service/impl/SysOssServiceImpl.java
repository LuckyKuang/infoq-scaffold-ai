package cc.infoq.system.service.impl;

import cc.infoq.common.constant.CacheNames;
import cc.infoq.common.domain.dto.OssDTO;
import cc.infoq.common.exception.ServiceException;
import cc.infoq.common.json.utils.JsonUtils;
import cc.infoq.common.mybatis.core.page.PageQuery;
import cc.infoq.common.mybatis.core.page.TableDataInfo;
import cc.infoq.common.oss.core.OssClient;
import cc.infoq.common.oss.entity.UploadResult;
import cc.infoq.common.oss.enums.AccessPolicyType;
import cc.infoq.common.oss.factory.OssFactory;
import cc.infoq.common.service.OssService;
import cc.infoq.common.utils.MapstructUtils;
import cc.infoq.common.utils.SpringUtils;
import cc.infoq.common.utils.StreamUtils;
import cc.infoq.common.utils.StringUtils;
import cc.infoq.common.utils.file.FileUtils;
import cc.infoq.system.domain.bo.SysOssBo;
import cc.infoq.system.domain.entity.SysOss;
import cc.infoq.system.domain.entity.SysOssExt;
import cc.infoq.system.domain.vo.SysOssVo;
import cc.infoq.system.mapper.SysOssMapper;
import cc.infoq.system.service.SysOssService;
import cn.hutool.core.bean.BeanUtil;
import cn.hutool.core.convert.Convert;
import cn.hutool.core.util.ObjectUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import jakarta.servlet.http.HttpServletResponse;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 文件上传 服务层实现
 *
 * @author Pontus
 */
@AllArgsConstructor
@Slf4j
@Service
public class SysOssServiceImpl implements SysOssService, OssService {

    private final SysOssMapper sysOssMapper;

    /**
     * 查询OSS对象存储列表
     *
     * @param bo        OSS对象存储分页查询对象
     * @param pageQuery 分页查询实体类
     * @return 结果
     */
    @Override
    public TableDataInfo<SysOssVo> queryPageList(SysOssBo bo, PageQuery pageQuery) {
        LambdaQueryWrapper<SysOss> lqw = buildQueryWrapper(bo);
        Page<SysOssVo> result = sysOssMapper.selectVoPage(pageQuery.build(), lqw);
        List<SysOssVo> filterResult = StreamUtils.toList(result.getRecords(), this::matchingUrl);
        result.setRecords(filterResult);
        return TableDataInfo.build(result);
    }

    /**
     * 根据一组 ossIds 获取对应的 SysOssVo 列表
     *
     * @param ossIds 一组文件在数据库中的唯一标识集合
     * @return 包含 SysOssVo 对象的列表
     */
    @Override
    public List<SysOssVo> listByIds(Collection<Long> ossIds) {
        List<SysOssVo> list = new ArrayList<>();
        if (ossIds.isEmpty()) {
            return list;
        }
        Map<Long, SysOssVo> ossById = sysOssMapper.selectVoByIds(ossIds).stream()
            .collect(Collectors.toMap(SysOssVo::getOssId, vo -> vo, (first, ignored) -> first));
        for (Long id : ossIds) {
            SysOssVo vo = ossById.get(id);
            if (ObjectUtil.isNotNull(vo)) {
                list.add(this.resolveAccessibleUrl(vo));
            }
        }
        return list;
    }

    /**
     * 根据一组 ossIds 获取对应文件的 URL 列表
     *
     * @param ossIds 以逗号分隔的 ossId 字符串
     * @return 以逗号分隔的文件 URL 字符串
     */
    @Override
    public String selectUrlByIds(String ossIds) {
        List<String> list = new ArrayList<>();
        List<Long> ids = StringUtils.splitTo(ossIds, Convert::toLong);
        if (ids.isEmpty()) {
            return "";
        }
        Map<Long, SysOssVo> ossById = sysOssMapper.selectVoByIds(ids).stream()
            .collect(Collectors.toMap(SysOssVo::getOssId, vo -> vo, (first, ignored) -> first));
        for (Long id : ids) {
            SysOssVo vo = ossById.get(id);
            if (ObjectUtil.isNotNull(vo)) {
                list.add(this.resolveAccessibleUrl(vo).getUrl());
            }
        }
        return StringUtils.joinComma(list);
    }

    @Override
    public List<OssDTO> selectByIds(String ossIds) {
        List<OssDTO> list = new ArrayList<>();
        List<Long> ids = StringUtils.splitTo(ossIds, Convert::toLong);
        if (ids.isEmpty()) {
            return list;
        }
        Map<Long, SysOssVo> ossById = sysOssMapper.selectVoByIds(ids).stream()
            .collect(Collectors.toMap(SysOssVo::getOssId, vo -> vo, (first, ignored) -> first));
        for (Long id : ids) {
            SysOssVo vo = ossById.get(id);
            if (ObjectUtil.isNotNull(vo)) {
                vo.setUrl(this.resolveAccessibleUrl(vo).getUrl());
                list.add(BeanUtil.toBean(vo, OssDTO.class));
            }
        }
        return list;
    }

    private LambdaQueryWrapper<SysOss> buildQueryWrapper(SysOssBo bo) {
        Map<String, Object> params = bo.getParams();
        LambdaQueryWrapper<SysOss> lqw = Wrappers.lambdaQuery();
        lqw.like(StringUtils.isNotBlank(bo.getFileName()), SysOss::getFileName, bo.getFileName());
        lqw.like(StringUtils.isNotBlank(bo.getOriginalName()), SysOss::getOriginalName, bo.getOriginalName());
        lqw.eq(StringUtils.isNotBlank(bo.getFileSuffix()), SysOss::getFileSuffix, bo.getFileSuffix());
        lqw.eq(StringUtils.isNotBlank(bo.getUrl()), SysOss::getUrl, bo.getUrl());
        lqw.between(params.get("beginCreateTime") != null && params.get("endCreateTime") != null,
            SysOss::getCreateTime, params.get("beginCreateTime"), params.get("endCreateTime"));
        lqw.eq(ObjectUtil.isNotNull(bo.getCreateBy()), SysOss::getCreateBy, bo.getCreateBy());
        lqw.eq(StringUtils.isNotBlank(bo.getService()), SysOss::getService, bo.getService());
        lqw.orderByAsc(SysOss::getOssId);
        return lqw;
    }

    /**
     * 根据 ossId 从缓存或数据库中获取 SysOssVo 对象
     *
     * @param ossId 文件在数据库中的唯一标识
     * @return SysOssVo 对象，包含文件信息
     */
    @Cacheable(cacheNames = CacheNames.SYS_OSS, key = "#ossId")
    @Override
    public SysOssVo getById(Long ossId) {
        return sysOssMapper.selectVoById(ossId);
    }


    /**
     * 文件下载方法，支持一次性下载完整文件
     *
     * @param ossId    OSS对象ID
     * @param response HttpServletResponse对象，用于设置响应头和向客户端发送文件内容
     */
    @Override
    public void download(Long ossId, HttpServletResponse response) throws IOException {
        SysOssVo sysOss = SpringUtils.getAopProxy(this).getById(ossId);
        if (ObjectUtil.isNull(sysOss)) {
            throw new ServiceException("文件数据不存在!");
        }
        FileUtils.setAttachmentResponseHeader(response, sysOss.getOriginalName());
        response.setContentType(MediaType.APPLICATION_OCTET_STREAM_VALUE + "; charset=UTF-8");
        OssClient storage = OssFactory.instance(sysOss.getService());
        storage.download(sysOss.getFileName(), response.getOutputStream(), response::setContentLengthLong);
    }

    /**
     * 上传 MultipartFile 到对象存储服务，并保存文件信息到数据库
     *
     * @param file 要上传的 MultipartFile 对象
     * @return 上传成功后的 SysOssVo 对象，包含文件信息
     * @throws ServiceException 如果上传过程中发生异常，则抛出 ServiceException 异常
     */
    @Override
    public SysOssVo upload(MultipartFile file) {
        if (ObjectUtil.isNull(file) || file.isEmpty()) {
            throw new ServiceException("上传文件不能为空");
        }
        String originalFileName = file.getOriginalFilename();
        if (ObjectUtil.isNull(originalFileName)) {
            throw new ServiceException("文件名不能为空");
        }
        String suffix = StringUtils.substring(originalFileName, originalFileName.lastIndexOf("."), originalFileName.length());
        OssClient storage = OssFactory.instance();
        UploadResult uploadResult;
        try {
            uploadResult = storage.uploadSuffix(file.getBytes(), suffix, file.getContentType());
        } catch (IOException e) {
            throw new ServiceException(e.getMessage());
        }
        SysOssExt ext1 = new SysOssExt();
        ext1.setFileSize(file.getSize());
        ext1.setContentType(file.getContentType());
        // 保存文件信息
        return buildResultEntity(originalFileName, suffix, storage.getConfigKey(), uploadResult, ext1);
    }

    /**
     * 上传文件到对象存储服务，并保存文件信息到数据库
     *
     * @param file 要上传的文件对象
     * @return 上传成功后的 SysOssVo 对象，包含文件信息
     */
    @Override
    public SysOssVo upload(File file) {
        if (ObjectUtil.isNull(file) || !file.isFile() || file.length() <= 0) {
            throw new ServiceException("上传文件不能为空");
        }
        String originalFileName = file.getName();
        String suffix = StringUtils.substring(originalFileName, originalFileName.lastIndexOf("."), originalFileName.length());
        OssClient storage = OssFactory.instance();
        long length = file.length();
        UploadResult uploadResult = storage.uploadSuffix(file, suffix);
        SysOssExt ext1 = new SysOssExt();
        ext1.setFileSize(length);
        // 保存文件信息
        return buildResultEntity(originalFileName, suffix, storage.getConfigKey(), uploadResult, ext1);
    }

    private SysOssVo buildResultEntity(String originalFileName, String suffix, String configKey, UploadResult uploadResult, SysOssExt ext1) {
        SysOss oss = new SysOss();
        oss.setUrl(uploadResult.getUrl());
        oss.setFileSuffix(suffix);
        oss.setFileName(uploadResult.getFilename());
        oss.setOriginalName(originalFileName);
        oss.setService(configKey);
        oss.setExt1(JsonUtils.toJsonString(ext1));
        sysOssMapper.insert(oss);
        SysOssVo sysOssVo = MapstructUtils.convert(oss, SysOssVo.class);
        return this.matchingUrl(sysOssVo);
    }

    /**
     * 删除OSS对象存储
     *
     * @param ids     OSS对象ID串
     * @param isValid 判断是否需要校验
     * @return 结果
     */
    @Override
    public Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid) {
        if (isValid) {
            // 做一些业务上的校验,判断是否需要校验
        }
        List<SysOss> list = sysOssMapper.selectByIds(ids);
        for (SysOss sysOss : list) {
            OssClient storage = OssFactory.instance(sysOss.getService());
            storage.delete(sysOss.getUrl());
        }
        return sysOssMapper.deleteByIds(ids) > 0;
    }

    /**
     * 桶类型为 private 的URL 修改为临时URL时长为120s
     *
     * @param oss OSS对象
     * @return oss 匹配Url的OSS对象
     */
    private SysOssVo matchingUrl(SysOssVo oss) {
        OssClient storage = OssFactory.instance(oss.getService());
        // 仅修改桶类型为 private 的URL，临时URL时长为120s
        if (AccessPolicyType.PRIVATE == storage.getAccessPolicy()) {
            oss.setUrl(storage.createPresignedGetUrl(oss.getFileName(), Duration.ofSeconds(120)));
        }
        return oss;
    }

    private SysOssVo resolveAccessibleUrl(SysOssVo oss) {
        try {
            return this.matchingUrl(oss);
        } catch (Exception e) {
            log.error("获取OSS访问地址失败, ossId={}, service={}, fileName={}",
                oss.getOssId(), oss.getService(), oss.getFileName(), e);
            throw new ServiceException("获取OSS访问地址失败: {}", oss.getOriginalName());
        }
    }
}
