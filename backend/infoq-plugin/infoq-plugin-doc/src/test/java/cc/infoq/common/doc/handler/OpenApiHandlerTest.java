package cc.infoq.common.doc.handler;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.Operation;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springdoc.core.properties.SpringDocConfigProperties;
import org.springdoc.core.providers.JavadocProvider;
import org.springdoc.core.service.SecurityService;
import org.springdoc.core.utils.PropertyResolverUtils;
import org.springframework.web.method.HandlerMethod;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@Tag("dev")
class OpenApiHandlerTest {

    @Test
    @DisplayName("buildTags: should merge method/class tags and springdoc tags")
    void buildTagsShouldMergeMethodClassAndSpringdocTags() throws Exception {
        SecurityService securityService = mock(SecurityService.class);
        PropertyResolverUtils resolverUtils = mock(PropertyResolverUtils.class);
        when(resolverUtils.resolve(anyString(), any(Locale.class)))
            .thenAnswer(invocation -> "resolved:" + invocation.getArgument(0));
        when(securityService.getSecurityRequirements(any(HandlerMethod.class)))
            .thenReturn(new io.swagger.v3.oas.annotations.security.SecurityRequirement[0]);

        SpringDocConfigProperties properties = new SpringDocConfigProperties();
        properties.setAutoTagClasses(false);
        OpenApiHandler handler = new OpenApiHandler(
            Optional.of(new OpenAPI()),
            securityService,
            properties,
            resolverUtils,
            Optional.empty(),
            Optional.empty(),
            Optional.empty()
        );

        Method endpoint = TaggedController.class.getMethod("endpoint");
        HandlerMethod handlerMethod = new HandlerMethod(new TaggedController(), endpoint);
        addSpringdocTag(handler, handlerMethod, "springdoc-tag");

        Operation operation = new Operation();
        operation.addTagsItem("existing");
        OpenAPI openAPI = new OpenAPI();

        Operation result = handler.buildTags(handlerMethod, operation, openAPI, Locale.CHINA);

        assertNotNull(result.getTags());
        assertTrue(result.getTags().contains("existing"));
        assertTrue(result.getTags().contains("springdoc-tag"));
        assertEquals(List.of(), result.getSecurity());

        assertNotNull(openAPI.getTags());
        assertTrue(openAPI.getTags().stream().anyMatch(t -> "springdoc-tag".equals(t.getName())));
        verify(securityService, never()).buildSecurityRequirement(any(), any(Operation.class));
    }

    @Test
    @DisplayName("buildTags: should auto tag from javadoc when enabled")
    void buildTagsShouldAutoTagFromJavadocWhenEnabled() throws Exception {
        SecurityService securityService = mock(SecurityService.class);
        PropertyResolverUtils resolverUtils = mock(PropertyResolverUtils.class);
        when(resolverUtils.resolve(anyString(), any(Locale.class)))
            .thenAnswer(invocation -> invocation.getArgument(0));
        when(securityService.getSecurityRequirements(any(HandlerMethod.class))).thenReturn(null);

        JavadocProvider javadocProvider = mock(JavadocProvider.class);
        when(javadocProvider.getClassJavadoc(UntaggedController.class))
            .thenReturn("AutoTagName\nline2");

        SpringDocConfigProperties properties = new SpringDocConfigProperties();
        properties.setAutoTagClasses(true);
        OpenApiHandler handler = new OpenApiHandler(
            Optional.of(new OpenAPI()),
            securityService,
            properties,
            resolverUtils,
            Optional.empty(),
            Optional.empty(),
            Optional.of(javadocProvider)
        );

        Method endpoint = UntaggedController.class.getMethod("endpoint");
        HandlerMethod handlerMethod = new HandlerMethod(new UntaggedController(), endpoint);
        Operation operation = new Operation();
        OpenAPI openAPI = new OpenAPI();

        Operation result = handler.buildTags(handlerMethod, operation, openAPI, Locale.CHINA);

        assertNotNull(result.getTags());
        assertTrue(result.getTags().contains("AutoTagName"));
        assertNotNull(openAPI.getTags());
        assertTrue(openAPI.getTags().stream().anyMatch(t -> "AutoTagName".equals(t.getName())));
    }

    @Test
    @DisplayName("buildTags: should support @Tags container and deduplicate same tag names")
    void buildTagsShouldSupportContainerTagsAndDeduplicate() throws Exception {
        SecurityService securityService = mock(SecurityService.class);
        PropertyResolverUtils resolverUtils = mock(PropertyResolverUtils.class);
        when(resolverUtils.resolve(anyString(), any(Locale.class)))
            .thenAnswer(invocation -> invocation.getArgument(0));
        when(securityService.getSecurityRequirements(any(HandlerMethod.class))).thenReturn(null);

        SpringDocConfigProperties properties = new SpringDocConfigProperties();
        properties.setAutoTagClasses(false);
        OpenApiHandler handler = new OpenApiHandler(
            Optional.of(new OpenAPI()),
            securityService,
            properties,
            resolverUtils,
            Optional.empty(),
            Optional.empty(),
            Optional.empty()
        );

        Method endpoint = MultiTagController.class.getMethod("endpoint");
        HandlerMethod handlerMethod = new HandlerMethod(new MultiTagController(), endpoint);
        Operation operation = new Operation();
        OpenAPI openAPI = new OpenAPI();

        Operation result = handler.buildTags(handlerMethod, operation, openAPI, Locale.CHINA);

        assertNotNull(result.getTags());
        assertTrue(result.getTags().contains("class-tag"));
        assertTrue(result.getTags().contains("method-extra"));
        long classTagCount = result.getTags().stream().filter("class-tag"::equals).count();
        assertEquals(1L, classTagCount);
        assertNotNull(openAPI.getTags());
        assertTrue(openAPI.getTags().stream().anyMatch(tag -> "method-extra".equals(tag.getName())));
    }

    private static void addSpringdocTag(OpenApiHandler handler, HandlerMethod handlerMethod, String tagName) throws Exception {
        Field field = OpenApiHandler.class.getDeclaredField("springdocTags");
        field.setAccessible(true);
        Object springdocTags = field.get(handler);
        Method put = Map.class.getMethod("put", Object.class, Object.class);
        put.invoke(springdocTags, handlerMethod, new io.swagger.v3.oas.models.tags.Tag().name(tagName).description("manual"));
    }

    @io.swagger.v3.oas.annotations.tags.Tag(name = "class-tag", description = "class-desc")
    private static class TaggedController {

        @io.swagger.v3.oas.annotations.tags.Tag(name = "method-tag", description = "method-desc")
        public void endpoint() {
        }
    }

    private static class UntaggedController {

        public void endpoint() {
        }
    }

    @io.swagger.v3.oas.annotations.tags.Tag(name = "class-tag", description = "class-desc")
    private static class MultiTagController {

        @io.swagger.v3.oas.annotations.tags.Tags({
            @io.swagger.v3.oas.annotations.tags.Tag(name = "class-tag", description = "dup"),
            @io.swagger.v3.oas.annotations.tags.Tag(name = "method-extra", description = "extra")
        })
        public void endpoint() {
        }
    }
}
