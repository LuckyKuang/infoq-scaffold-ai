package cc.infoq.common.json.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertTrue;

@Tag("dev")
class Jackson3CustomizerTest {

    @Test
    @DisplayName("customize: oversized Long/long/BigInteger serialize as string, safe values stay numeric")
    void customizeShouldProtectOversizedIntegers() {
        Jackson3Customizer customizer = new Jackson3Customizer();
        JsonMapper.Builder builder = JsonMapper.builder();
        customizer.customize(builder);
        JsonMapper mapper = builder.build();

        Payload payload = new Payload(
            2102531905990766593L,
            9007199254740991L,
            new BigInteger("2102531905990766593"),
            42
        );

        String json = mapper.writeValueAsString(payload);
        assertTrue(json.contains("\"boxId\":\"2102531905990766593\""),
            "oversized Long must serialize as string, actual: " + json);
        assertTrue(json.contains("\"plainId\":9007199254740991"),
            "Long at MAX_SAFE_INTEGER boundary must stay numeric, actual: " + json);
        assertTrue(json.contains("\"bigValue\":\"2102531905990766593\""),
            "oversized BigInteger must serialize as string, actual: " + json);
        assertTrue(json.contains("\"small\":42"),
            "unrelated numeric types must stay numeric, actual: " + json);

        String oversized = mapper.writeValueAsString(
            new Payload(1L, 2102531905990766593L, BigInteger.ONE, 1));
        assertTrue(oversized.contains("\"plainId\":\"2102531905990766593\""),
            "oversized primitive long must serialize as string, actual: " + oversized);
    }

    @Test
    @DisplayName("customize: BigDecimal and LocalDateTime use the unified wire format")
    void customizeShouldUseUnifiedDecimalAndDateTimeFormat() {
        Jackson3Customizer customizer = new Jackson3Customizer();
        JsonMapper.Builder builder = JsonMapper.builder();
        customizer.customize(builder);
        JsonMapper mapper = builder.build();

        String json = mapper.writeValueAsString(new FormatPayload(
            new BigDecimal("123.45"), LocalDateTime.of(2026, 3, 8, 12, 34, 56)));

        assertTrue(json.contains("\"amount\":\"123.45\""), "actual: " + json);
        assertTrue(json.contains("\"at\":\"2026-03-08 12:34:56\""), "actual: " + json);
    }

    record Payload(Long boxId, long plainId, BigInteger bigValue, Integer small) {
    }

    record FormatPayload(BigDecimal amount, LocalDateTime at) {
    }
}