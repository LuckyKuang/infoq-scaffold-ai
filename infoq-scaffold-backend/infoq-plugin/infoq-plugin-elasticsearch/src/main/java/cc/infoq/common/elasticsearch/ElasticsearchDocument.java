package cc.infoq.common.elasticsearch;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

public record ElasticsearchDocument(String index, String id, Map<String, Object> source) {

    public ElasticsearchDocument {
        if (index == null || index.isBlank()) {
            throw new IllegalArgumentException("index must not be blank");
        }
        if (id == null || id.isBlank()) {
            throw new IllegalArgumentException("id must not be blank");
        }
        source = Collections.unmodifiableMap(new LinkedHashMap<>(Objects.requireNonNull(source,
            "source must not be null")));
    }
}
