package cc.infoq.common.doc.handler;

import cc.infoq.common.utils.StreamUtils;
import cn.hutool.core.io.IoUtil;
import io.swagger.v3.core.jackson.TypeNameResolver;
import io.swagger.v3.core.util.AnnotationsUtils;
import io.swagger.v3.oas.annotations.tags.Tags;
import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.Operation;
import io.swagger.v3.oas.models.Paths;
import io.swagger.v3.oas.models.tags.Tag;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springdoc.core.customizers.OpenApiBuilderCustomizer;
import org.springdoc.core.customizers.ServerBaseUrlCustomizer;
import org.springdoc.core.properties.SpringDocConfigProperties;
import org.springdoc.core.providers.JavadocProvider;
import org.springdoc.core.service.OpenAPIService;
import org.springdoc.core.service.SecurityService;
import org.springdoc.core.utils.PropertyResolverUtils;
import org.springframework.context.ApplicationContext;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.util.CollectionUtils;
import org.springframework.web.method.HandlerMethod;

import java.io.StringReader;
import java.lang.reflect.Method;
import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * 自定义 openapi 处理器
 * 对源码功能进行修改 增强使用
 */
@Slf4j
public class OpenApiHandler extends OpenAPIService {

    /**
     * 基础错误控制器
     */
    private static Class<?> basicErrorController;

    /**
     * 安全解析器
     */
    private final SecurityService securityParser;

    /**
     * 映射 Map
     */
    private final Map<String, Object> mappingsMap = new HashMap<>();

    /**
     * Springdoc 标签 Map
     */
    private final Map<HandlerMethod, Tag> springdocTags = new HashMap<>();

    /**
     * OpenAPI 构建器定制器列表
     */
    private final Optional<List<OpenApiBuilderCustomizer>> openApiBuilderCustomisers;

    /**
     * 服务器基础 URL 定制器列表
     */
    private final Optional<List<ServerBaseUrlCustomizer>> serverBaseUrlCustomizers;

    /**
     * Spring Doc 配置属性
     */
    private final SpringDocConfigProperties springDocConfigProperties;

    /**
     * 缓存的 OpenAPI Map
     */
    private final Map<String, OpenAPI> cachedOpenAPI = new HashMap<>();

    /**
     * 属性解析工具类
     */
    private final PropertyResolverUtils propertyResolverUtils;

    /**
     * Javadoc 提供器
     */
    private final Optional<JavadocProvider> javadocProvider;

    /**
     * 应用上下文
     */
    private ApplicationContext context;

    /**
     * OpenAPI 对象
     */
    private OpenAPI openAPI;

    /**
     * 是否已设置服务器
     */
    private boolean isServersPresent;

    /**
     * 服务器基础 URL
     */
    private String serverBaseUrl;

    /**
     * 构造 OpenAPI 构建器
     *
     * @param openAPI                   OpenAPI 对象
     * @param securityParser            安全解析器
     * @param springDocConfigProperties Spring Doc 配置属性
     * @param propertyResolverUtils     属性解析工具
     * @param openApiBuilderCustomizers OpenAPI 构建器定制器列表
     * @param serverBaseUrlCustomizers  服务器基础 URL 定制器列表
     * @param javadocProvider           Javadoc 提供器
     */
    public OpenApiHandler(Optional<OpenAPI> openAPI, SecurityService securityParser,
                          SpringDocConfigProperties springDocConfigProperties, PropertyResolverUtils propertyResolverUtils,
                          Optional<List<OpenApiBuilderCustomizer>> openApiBuilderCustomizers,
                          Optional<List<ServerBaseUrlCustomizer>> serverBaseUrlCustomizers,
                          Optional<JavadocProvider> javadocProvider) {
        super(openAPI, securityParser, springDocConfigProperties, propertyResolverUtils, openApiBuilderCustomizers, serverBaseUrlCustomizers, javadocProvider);
        if (openAPI.isPresent()) {
            this.openAPI = openAPI.get();
            if (this.openAPI.getComponents() == null)
                this.openAPI.setComponents(new Components());
            if (this.openAPI.getPaths() == null)
                this.openAPI.setPaths(new Paths());
            if (!CollectionUtils.isEmpty(this.openAPI.getServers()))
                this.isServersPresent = true;
        }
        this.propertyResolverUtils = propertyResolverUtils;
        this.securityParser = securityParser;
        this.springDocConfigProperties = springDocConfigProperties;
        this.openApiBuilderCustomisers = openApiBuilderCustomizers;
        this.serverBaseUrlCustomizers = serverBaseUrlCustomizers;
        this.javadocProvider = javadocProvider;
        if (springDocConfigProperties.isUseFqn())
            TypeNameResolver.std.setUseFqn(true);
    }

    @Override
    public Operation buildTags(HandlerMethod handlerMethod, Operation operation, OpenAPI openAPI, Locale locale) {

        Set<Tag> tags = new HashSet<>();
        Set<String> tagsStr = new HashSet<>();

        buildTagsFromMethod(handlerMethod.getMethod(), tags, tagsStr, locale);
        buildTagsFromClass(handlerMethod.getBeanType(), tags, tagsStr, locale);

        if (!CollectionUtils.isEmpty(tagsStr))
            tagsStr = tagsStr.stream()
                .map(str -> propertyResolverUtils.resolve(str, locale))
                .collect(Collectors.toSet());

        if (springdocTags.containsKey(handlerMethod)) {
            io.swagger.v3.oas.models.tags.Tag tag = springdocTags.get(handlerMethod);
            tagsStr.add(tag.getName());
            if (openAPI.getTags() == null || !openAPI.getTags().contains(tag)) {
                openAPI.addTagsItem(tag);
            }
        }

        if (!CollectionUtils.isEmpty(tagsStr)) {
            if (CollectionUtils.isEmpty(operation.getTags()))
                operation.setTags(new ArrayList<>(tagsStr));
            else {
                Set<String> operationTagsSet = new HashSet<>(operation.getTags());
                operationTagsSet.addAll(tagsStr);
                operation.getTags().clear();
                operation.getTags().addAll(operationTagsSet);
            }
        }

        if (isAutoTagClasses(operation)) {
            if (javadocProvider.isPresent()) {
                String description = javadocProvider.get().getClassJavadoc(handlerMethod.getBeanType());
                if (StringUtils.isNotBlank(description)) {
                    io.swagger.v3.oas.models.tags.Tag tag = new io.swagger.v3.oas.models.tags.Tag();

                    // 使用 Java 类的 Javadoc 首行作为 tag 名称
                    List<String> list = IoUtil.readLines(new StringReader(description), new ArrayList<>());
                    tag.setName(list.get(0));
                    operation.addTagsItem(list.get(0));

                    tag.setDescription(description);
                    if (openAPI.getTags() == null || !openAPI.getTags().contains(tag)) {
                        openAPI.addTagsItem(tag);
                    }
                }
            } else {
                String tagAutoName = splitCamelCase(handlerMethod.getBeanType().getSimpleName());
                operation.addTagsItem(tagAutoName);
            }
        }

        if (!CollectionUtils.isEmpty(tags)) {
            // 已存在的标签
            List<io.swagger.v3.oas.models.tags.Tag> openApiTags = openAPI.getTags();
            if (!CollectionUtils.isEmpty(openApiTags))
                tags.addAll(openApiTags);
            openAPI.setTags(new ArrayList<>(tags));
        }

        // 处理操作级别的安全要求
        io.swagger.v3.oas.annotations.security.SecurityRequirement[] securityRequirements = securityParser
            .getSecurityRequirements(handlerMethod);
        if (securityRequirements != null) {
            if (securityRequirements.length == 0)
                operation.setSecurity(Collections.emptyList());
            else
                securityParser.buildSecurityRequirement(securityRequirements, operation);
        }

        return operation;
    }

    private void buildTagsFromMethod(Method method, Set<io.swagger.v3.oas.models.tags.Tag> tags, Set<String> tagsStr, Locale locale) {
        // 方法标签
        Set<Tags> tagsSet = AnnotatedElementUtils
            .findAllMergedAnnotations(method, Tags.class);
        Set<io.swagger.v3.oas.annotations.tags.Tag> methodTags = tagsSet.stream()
            .flatMap(x -> Stream.of(x.value())).collect(Collectors.toSet());
        methodTags.addAll(AnnotatedElementUtils.findAllMergedAnnotations(method, io.swagger.v3.oas.annotations.tags.Tag.class));
        if (!CollectionUtils.isEmpty(methodTags)) {
            tagsStr.addAll(StreamUtils.toSet(methodTags, tag -> propertyResolverUtils.resolve(tag.name(), locale)));
            List<io.swagger.v3.oas.annotations.tags.Tag> allTags = new ArrayList<>(methodTags);
            addTags(allTags, tags, locale);
        }
    }

    private void addTags(List<io.swagger.v3.oas.annotations.tags.Tag> sourceTags, Set<io.swagger.v3.oas.models.tags.Tag> tags, Locale locale) {
        Optional<Set<io.swagger.v3.oas.models.tags.Tag>> optionalTagSet = AnnotationsUtils
            .getTags(sourceTags.toArray(new io.swagger.v3.oas.annotations.tags.Tag[0]), true);
        optionalTagSet.ifPresent(tagsSet -> {
            tagsSet.forEach(tag -> {
                tag.name(propertyResolverUtils.resolve(tag.getName(), locale));
                tag.description(propertyResolverUtils.resolve(tag.getDescription(), locale));
                if (tags.stream().noneMatch(t -> t.getName().equals(tag.getName())))
                    tags.add(tag);
            });
        });
    }

}
