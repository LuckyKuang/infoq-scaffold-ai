package cc.infoq.common.elasticsearch;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.util.*;

public record ElasticsearchIndexDefinition(String index,
                                           Map<String, Object> settings,
                                           Map<String, Object> mappings) {

    public ElasticsearchIndexDefinition {
        if (index == null || index.isBlank()) {
            throw new IllegalArgumentException("index must not be blank");
        }
        settings = immutableObject(settings, "settings");
        mappings = immutableObject(mappings, "mappings");
    }

    private static Map<String, Object> immutableObject(Map<String, Object> value, String name) {
        Objects.requireNonNull(value, name + " must not be null");
        return immutableMap(value, name);
    }

    private static Map<String, Object> immutableMap(Map<?, ?> value, String path) {
        Map<String, Object> copy = new LinkedHashMap<>();
        for (Map.Entry<?, ?> entry : value.entrySet()) {
            if (!(entry.getKey() instanceof String key)) {
                throw new IllegalArgumentException(path + " keys must be strings");
            }
            copy.put(key, immutableJsonValue(entry.getValue(), path + "." + key));
        }
        return Collections.unmodifiableMap(copy);
    }

    private static Object immutableJsonValue(Object value, String path) {
        if (value == null || value instanceof String || value instanceof Boolean || value instanceof Byte
            || value instanceof Short || value instanceof Integer || value instanceof Long || value instanceof BigInteger
            || value instanceof BigDecimal) {
            return value;
        }
        if (value instanceof Float number) {
            if (!Float.isFinite(number)) {
                throw new IllegalArgumentException(path + " must not be NaN or infinite");
            }
            return number;
        }
        if (value instanceof Double number) {
            if (!Double.isFinite(number)) {
                throw new IllegalArgumentException(path + " must not be NaN or infinite");
            }
            return number;
        }
        if (value instanceof Map<?, ?> object) {
            return immutableMap(object, path);
        }
        if (value instanceof List<?> array) {
            List<Object> copy = new ArrayList<>(array.size());
            for (int index = 0; index < array.size(); index++) {
                copy.add(immutableJsonValue(array.get(index), path + "[" + index + "]"));
            }
            return Collections.unmodifiableList(copy);
        }
        throw new IllegalArgumentException(path + " must be JSON-compatible");
    }
}
