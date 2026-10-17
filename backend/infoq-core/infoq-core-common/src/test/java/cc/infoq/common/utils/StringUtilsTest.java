package cc.infoq.common.utils;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertIterableEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Tag("dev")
class StringUtilsTest {

    @Test
    @DisplayName("str2List/str2Set: should split/trim/filter values correctly")
    void str2ListAndSetShouldWork() {
        List<String> list = StringUtils.str2List(" a, ,b,, c ", ",", true, true);
        Set<String> set = StringUtils.str2Set("a,a,b", ",");

        assertIterableEquals(List.of("a", "b", "c"), list);
        assertEquals(Set.of("a", "b"), set);
    }

    @Test
    @DisplayName("matches/isMatch: should support ant style path matching")
    void matchesShouldSupportPatterns() {
        assertTrue(StringUtils.isMatch("/api/**", "/api/v1/users"));
        assertTrue(StringUtils.matches("/admin/user/list", List.of("/api/**", "/admin/**")));
        assertFalse(StringUtils.matches("/health", List.of("/api/**", "/admin/**")));
    }

    @Test
    @DisplayName("padl: should pad or crop values as expected")
    void padlShouldPadOrCrop() {
        assertEquals("0012", StringUtils.padl(12, 4));
        assertEquals("789", StringUtils.padl("123456789", 3, '0'));
        assertEquals("000", StringUtils.padl((String) null, 3, '0'));
    }

    @Test
    @DisplayName("splitTo/startWithAnyIgnoreCase: should convert tokens and check prefixes")
    void splitToAndPrefixCheckShouldWork() {
        assertIterableEquals(List.of(1, 2, 3), StringUtils.splitTo("1,2,3", value -> Integer.parseInt(value.toString())));
        assertTrue(StringUtils.startWithAnyIgnoreCase("Bearer abc", "bearer ", "basic "));
        assertFalse(StringUtils.startWithAnyIgnoreCase("Token abc", "bearer ", "basic "));
    }

    @Test
    @DisplayName("convert/joinComma: should keep blank input and join values")
    void convertAndJoinShouldWork() {
        assertEquals("", StringUtils.convert("", StandardCharsets.UTF_8, StandardCharsets.UTF_8));
        assertEquals("abc", StringUtils.convert("abc", StandardCharsets.UTF_8, StandardCharsets.UTF_8));
        assertEquals("a,b,c", StringUtils.joinComma(List.of("a", "b", "c")));
        assertEquals("1,2,3", StringUtils.joinComma(new Object[]{1, 2, 3}));
    }

    @Test
    @DisplayName("extra helpers: should cover format/camel/http/split/substring branches")
    void extraHelpersShouldWork() {
        assertEquals("fallback", StringUtils.blankToDefault("   ", "fallback"));
        assertTrue(StringUtils.containsAnyIgnoreCase("HelloWorld", "x", "world"));
        assertEquals("HelloWorld", StringUtils.convertToCamelCase("HELLO_WORLD"));
        assertEquals("helloWorld", StringUtils.toCamelCase("hello_world"));
        assertEquals("hello_world", StringUtils.toUnderScoreCase("helloWorld"));
        assertTrue(StringUtils.inStringIgnoreCase("ADMIN", "guest", "admin"));
        assertEquals("A-B", StringUtils.format("{}-{}", "A", "B"));
        assertTrue(StringUtils.ishttp("https://infoq.cc"));
        assertFalse(StringUtils.ishttp("not-url"));

        assertIterableEquals(List.of("a", "b", "c"), StringUtils.splitList("a|b|c", "|"));
        assertIterableEquals(List.of("a", "b", "c"), StringUtils.splitList("a,b,c"));
        assertEquals("bc", StringUtils.substring("abcd", 1, 3));
        assertEquals("cd", StringUtils.substring("abcd", 2));
    }
}
