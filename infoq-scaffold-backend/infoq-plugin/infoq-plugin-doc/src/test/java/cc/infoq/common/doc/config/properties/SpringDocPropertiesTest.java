package cc.infoq.common.doc.config.properties;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.ExternalDocumentation;
import io.swagger.v3.oas.models.Paths;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.License;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;

@Tag("dev")
class SpringDocPropertiesTest {

    @Test
    @DisplayName("properties: should keep configured openapi metadata")
    void propertiesShouldKeepConfiguredOpenApiMetadata() {
        SpringDocProperties properties = new SpringDocProperties();
        SpringDocProperties.InfoProperties info = new SpringDocProperties.InfoProperties();
        Contact contact = new Contact().name("infoq");
        License license = new License().name("Apache-2.0");
        ExternalDocumentation externalDocs = new ExternalDocumentation().description("more docs");
        Paths paths = new Paths();
        Components components = new Components();
        List<io.swagger.v3.oas.models.tags.Tag> tags = List.of(new io.swagger.v3.oas.models.tags.Tag().name("system"));

        info.setTitle("InfoQ API");
        info.setDescription("API docs");
        info.setVersion("2.1.7");
        info.setContact(contact);
        info.setLicense(license);

        properties.setInfo(info);
        properties.setExternalDocs(externalDocs);
        properties.setTags(tags);
        properties.setPaths(paths);
        properties.setComponents(components);

        assertEquals("InfoQ API", properties.getInfo().getTitle());
        assertEquals("API docs", properties.getInfo().getDescription());
        assertEquals("2.1.7", properties.getInfo().getVersion());
        assertSame(contact, properties.getInfo().getContact());
        assertSame(license, properties.getInfo().getLicense());
        assertSame(externalDocs, properties.getExternalDocs());
        assertSame(tags, properties.getTags());
        assertSame(paths, properties.getPaths());
        assertSame(components, properties.getComponents());
    }
}
