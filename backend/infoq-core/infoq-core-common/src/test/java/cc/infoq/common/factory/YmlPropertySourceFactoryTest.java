package cc.infoq.common.factory;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.core.env.PropertySource;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.support.EncodedResource;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

@Tag("dev")
class YmlPropertySourceFactoryTest {

    @Test
    @DisplayName("createPropertySource: should parse yml resource")
    void createPropertySourceShouldParseYmlResource() throws IOException {
        YmlPropertySourceFactory factory = new YmlPropertySourceFactory();
        EncodedResource resource = new EncodedResource(namedResource("app-dev.yml", "demo:\n  name: infoq\n"));

        PropertySource<?> source = factory.createPropertySource("demo", resource);

        assertEquals("app-dev.yml", source.getName());
        assertEquals("infoq", source.getProperty("demo.name"));
    }

    @Test
    @DisplayName("createPropertySource: should fallback to default factory for non-yaml resource")
    void createPropertySourceShouldFallbackForNonYaml() throws IOException {
        YmlPropertySourceFactory factory = new YmlPropertySourceFactory();
        EncodedResource resource = new EncodedResource(namedResource("app.properties", "demo.name=infoq\n"));

        PropertySource<?> source = factory.createPropertySource("demo", resource);

        assertNotNull(source);
        assertEquals("infoq", source.getProperty("demo.name"));
    }

    private static ByteArrayResource namedResource(String filename, String content) {
        return new ByteArrayResource(content.getBytes(StandardCharsets.UTF_8)) {
            @Override
            public String getFilename() {
                return filename;
            }
        };
    }
}
