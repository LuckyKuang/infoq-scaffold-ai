package cc.infoq.common.json.utils;

import cc.infoq.common.utils.SpringUtils;
import cn.hutool.core.lang.Dict;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.context.support.GenericApplicationContext;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Tag("dev")
class JsonUtilsTest {

    @BeforeAll
    static void initSpringContext() {
        GenericApplicationContext context = new GenericApplicationContext();
        context.registerBean(ObjectMapper.class, () -> new ObjectMapper());
        context.refresh();
        new SpringUtils().setApplicationContext(context);
    }

    @Test
    @DisplayName("toJsonString/parseObject: should serialize and deserialize simple object")
    void serializeAndDeserializeShouldWork() {
        assertNotNull(JsonUtils.getObjectMapper());

        Map<String, Object> source = Map.of("id", 1, "name", "alice");
        String json = JsonUtils.toJsonString(source);

        Map<String, Object> result = JsonUtils.parseObject(json, new TypeReference<>() {});
        assertNotNull(json);
        assertEquals("alice", result.get("name"));
        assertNull(JsonUtils.parseObject("", Map.class));
    }

    @Test
    @DisplayName("parseObject with TypeReference/bytes: should parse complex and byte payload")
    void parseWithTypeReferenceAndBytesShouldWork() {
        String json = "[{\"id\":1},{\"id\":2}]";
        List<Map<String, Integer>> list = JsonUtils.parseObject(json, new TypeReference<>() {});
        Map parsed = JsonUtils.parseObject("{\"ok\":true}".getBytes(), Map.class);

        assertEquals(2, list.size());
        assertEquals(Boolean.TRUE, parsed.get("ok"));
        assertNull(JsonUtils.parseObject(new byte[0], Map.class));
    }

    @Test
    @DisplayName("parseObjectStrict: should fail when payload contains unknown properties")
    void parseObjectStrictShouldRejectUnknownProperties() {
        assertThrows(RuntimeException.class,
            () -> JsonUtils.parseObjectStrict("{\"clientId\":\"pc\",\"grantType\":\"password\",\"extra\":true}", StrictLoginBody.class));
    }

    @Test
    @DisplayName("parseMap/parseArrayMap/parseArray: should parse dict/map/list variants")
    void parseMapAndArrayShouldWork() {
        Dict dict = JsonUtils.parseMap("{\"k\":\"v\"}");
        List<Dict> dicts = JsonUtils.parseArrayMap("[{\"a\":1}]");
        List<Integer> numbers = JsonUtils.parseArray("[1,2,3]", Integer.class);
        List<Integer> empty = JsonUtils.parseArray("", Integer.class);

        assertEquals("v", dict.get("k"));
        assertEquals(1, dicts.size());
        assertEquals(List.of(1, 2, 3), numbers);
        assertTrue(empty.isEmpty());
        assertThrows(RuntimeException.class, () -> JsonUtils.parseMap("not-json"));
    }

    @Test
    @DisplayName("isJson/isJsonObject/isJsonArray: should identify valid and invalid payloads")
    void jsonTypeDetectionShouldWork() {
        assertTrue(JsonUtils.isJson("{\"a\":1}"));
        assertTrue(JsonUtils.isJson("[1,2]"));
        assertFalse(JsonUtils.isJson("x"));

        assertTrue(JsonUtils.isJsonObject("{\"a\":1}"));
        assertFalse(JsonUtils.isJsonObject("[1,2]"));

        assertTrue(JsonUtils.isJsonArray("[1,2]"));
        assertFalse(JsonUtils.isJsonArray("{\"a\":1}"));
    }

    public static class StrictLoginBody {
        private String clientId;
        private String grantType;

        public String getClientId() {
            return clientId;
        }

        public void setClientId(String clientId) {
            this.clientId = clientId;
        }

        public String getGrantType() {
            return grantType;
        }

        public void setGrantType(String grantType) {
            this.grantType = grantType;
        }
    }
}
