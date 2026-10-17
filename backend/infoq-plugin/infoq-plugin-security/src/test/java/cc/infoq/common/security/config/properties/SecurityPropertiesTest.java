package cc.infoq.common.security.config.properties;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;

@Tag("dev")
class SecurityPropertiesTest {

    @Test
    @DisplayName("properties: should store excludes array")
    void shouldStoreExcludesArray() {
        SecurityProperties properties = new SecurityProperties();
        String[] excludes = new String[]{"/public/**", "/auth/**"};

        properties.setExcludes(excludes);

        assertArrayEquals(excludes, properties.getExcludes());
    }
}
