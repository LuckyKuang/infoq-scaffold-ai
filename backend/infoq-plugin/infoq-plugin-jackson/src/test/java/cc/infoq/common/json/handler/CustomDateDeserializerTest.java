package cc.infoq.common.json.handler;

import cn.hutool.core.date.DateUtil;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;

import java.util.Date;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.mockStatic;

@Tag("dev")
class CustomDateDeserializerTest {

    @Test
    @DisplayName("deserialize: should convert date text into java.util.Date")
    void deserializeShouldConvertDateText() throws Exception {
        CustomDateDeserializer deserializer = new CustomDateDeserializer();
        JsonParser parser = new ObjectMapper().getFactory().createParser("\"2026-03-08 12:34:56\"");
        parser.nextToken();

        Date result = deserializer.deserialize(parser, null);
        assertNotNull(result);
    }

    @Test
    @DisplayName("deserialize: should return null when DateUtil.parse returns null")
    void deserializeShouldReturnNullWhenParseResultIsNull() throws Exception {
        CustomDateDeserializer deserializer = new CustomDateDeserializer();
        JsonParser parser = new ObjectMapper().getFactory().createParser("\"\"");
        parser.nextToken();

        try (MockedStatic<DateUtil> dateUtil = mockStatic(DateUtil.class)) {
            dateUtil.when(() -> DateUtil.parse("")).thenReturn(null);
            Date result = deserializer.deserialize(parser, null);
            assertNull(result);
        }
    }
}
