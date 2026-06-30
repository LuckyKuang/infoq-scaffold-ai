package cc.infoq.common.doc.config;

import cc.infoq.common.doc.config.properties.SpringDocProperties;
import cc.infoq.common.doc.handler.OpenApiHandler;
import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.PathItem;
import io.swagger.v3.oas.models.Paths;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springdoc.core.properties.SpringDocConfigProperties;
import org.springdoc.core.service.OpenAPIService;
import org.springdoc.core.service.SecurityService;
import org.springdoc.core.utils.PropertyResolverUtils;
import org.springframework.boot.autoconfigure.web.ServerProperties;

import java.util.List;
import java.util.Locale;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@Tag("dev")
class SpringDocConfigTest {

    @Test
    @DisplayName("openApi: should build openapi info and security requirements from properties")
    void openApiShouldBuildInfoAndSecurity() {
        ServerProperties serverProperties = new ServerProperties();
        SpringDocConfig config = new SpringDocConfig(serverProperties);
        SpringDocProperties properties = new SpringDocProperties();
        SpringDocProperties.InfoProperties info = new SpringDocProperties.InfoProperties();

        info.setTitle("InfoQ API");
        info.setDescription("api docs");
        info.setVersion("2.1.7");
        info.setContact(new Contact().name("team"));
        info.setLicense(new License().name("Apache-2.0"));
        properties.setInfo(info);

        Components components = new Components();
        components.addSecuritySchemes("BearerAuth", new SecurityScheme().type(SecurityScheme.Type.HTTP).scheme("bearer"));
        properties.setComponents(components);
        properties.setPaths(new Paths().addPathItem("/system/user", new PathItem()));

        OpenAPI openAPI = config.openApi(properties);

        assertEquals("InfoQ API", openAPI.getInfo().getTitle());
        assertEquals("api docs", openAPI.getInfo().getDescription());
        assertEquals("2.1.7", openAPI.getInfo().getVersion());
        assertNotNull(openAPI.getSecurity());
        assertEquals(1, openAPI.getSecurity().size());
        assertTrue(openAPI.getSecurity().get(0).containsKey("BearerAuth"));
    }

    @Test
    @DisplayName("openApiCustomizer: should prepend context path only once")
    void openApiCustomizerShouldPrependContextPathOnlyOnce() {
        ServerProperties serverProperties = new ServerProperties();
        serverProperties.getServlet().setContextPath("/api");
        SpringDocConfig config = new SpringDocConfig(serverProperties);
        OpenAPI openAPI = new OpenAPI();
        openAPI.setPaths(new Paths().addPathItem("/system/role", new PathItem()));

        config.openApiCustomizer().customise(openAPI);
        config.openApiCustomizer().customise(openAPI);

        assertTrue(openAPI.getPaths().containsKey("/api/system/role"));
        assertEquals(1, openAPI.getPaths().size());
    }

    @Test
    @DisplayName("openApiBuilder: should create OpenApiHandler instance")
    void openApiBuilderShouldCreateOpenApiHandler() {
        ServerProperties serverProperties = new ServerProperties();
        SpringDocConfig config = new SpringDocConfig(serverProperties);

        SecurityService securityService = mock(SecurityService.class);
        SpringDocConfigProperties springDocConfigProperties = new SpringDocConfigProperties();
        PropertyResolverUtils propertyResolverUtils = mock(PropertyResolverUtils.class);
        when(propertyResolverUtils.resolve(anyString(), any(Locale.class))).thenAnswer(invocation -> invocation.getArgument(0));

        OpenAPIService service = config.openApiBuilder(
            Optional.of(new OpenAPI()),
            securityService,
            springDocConfigProperties,
            propertyResolverUtils,
            Optional.of(List.of()),
            Optional.of(List.of()),
            Optional.empty()
        );

        assertInstanceOf(OpenApiHandler.class, service);
    }
}
