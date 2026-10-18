package cc.infoq.common.redis.utils;

import cc.infoq.common.utils.SpringUtils;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.redisson.api.RIdGenerator;
import org.redisson.api.RedissonClient;
import org.springframework.context.support.GenericApplicationContext;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@Tag("dev")
class SequenceUtilsTest {

    private static RedissonClient redissonClient;
    private static RIdGenerator idGenerator;

    @BeforeAll
    static void initSpringContext() {
        redissonClient = mock(RedissonClient.class);
        idGenerator = mock(RIdGenerator.class);
        when(redissonClient.getIdGenerator(anyString())).thenReturn(idGenerator);

        GenericApplicationContext context = new GenericApplicationContext();
        context.registerBean(RedissonClient.class, () -> redissonClient);
        context.refresh();
        new SpringUtils().setApplicationContext(context);
    }

    @Test
    @DisplayName("getIdGenerator: should fallback to default init/step and apply expire")
    void getIdGeneratorShouldApplyDefaults() {
        SequenceUtils.getIdGenerator("order", Duration.ofSeconds(30), 0L, 0L);
        verify(idGenerator).tryInit(1L, 1L);
        verify(idGenerator).expire(Duration.ofSeconds(30));
    }

    @Test
    @DisplayName("getNextIdString/getPaddedNextIdString: should return expected id text")
    void nextIdStringShouldWork() {
        when(idGenerator.nextId()).thenReturn(12L);
        assertEquals("12", SequenceUtils.getNextIdString("invoice", Duration.ofSeconds(10)));

        when(idGenerator.nextId()).thenReturn(7L);
        assertEquals("0007", SequenceUtils.getPaddedNextIdString("invoice", Duration.ofSeconds(10), 4));
    }

    @Test
    @DisplayName("getDateId/getDateTimeId: should compose prefix/date/id with optional padding")
    void dateBasedIdShouldWork() {
        when(idGenerator.nextId()).thenReturn(5L, 6L);

        String dateId = SequenceUtils.getDateId("P", true, 3, LocalDate.of(2026, 3, 8), 1L, 1L);
        String dateTimeId = SequenceUtils.getDateTimeId("DT", false, 3, LocalDateTime.of(2026, 3, 8, 9, 10, 11), 1L, 1L);

        assertEquals("P20260308005", dateId);
        assertEquals("20260308091011006", dateTimeId);
    }

    @Test
    @DisplayName("getIdGenerator/getNextId overloads: should support explicit and default overloads")
    void idGeneratorAndNextIdOverloadsShouldWork() {
        when(idGenerator.nextId()).thenReturn(21L, 22L, 23L);

        assertNotNull(SequenceUtils.getIdGenerator("ticket", Duration.ofSeconds(20)));
        assertEquals(21L, SequenceUtils.getNextId("ticket", Duration.ofSeconds(20), 2L, 2L));
        assertEquals(22L, SequenceUtils.getNextId("ticket", Duration.ofSeconds(20)));
        assertEquals("23", SequenceUtils.getNextIdString("ticket", Duration.ofSeconds(20), 2L, 2L));
    }

    @Test
    @SuppressWarnings("deprecation")
    @DisplayName("date/dateTime wrapper methods: should cover deprecated and convenience overloads")
    void dateAndDateTimeWrapperMethodsShouldWork() {
        when(idGenerator.nextId()).thenReturn(1L, 2L, 3L, 4L, 5L, 6L, 7L, 8L, 9L, 10L, 11L, 12L);
        Pattern dateIdPattern = Pattern.compile("^[A-Za-z0-9]*\\d{8}\\d+$");
        Pattern dateTimeIdPattern = Pattern.compile("^[A-Za-z0-9]*\\d{14}\\d+$");

        String deprecatedDateId = SequenceUtils.getDateId();
        String prefixedDateId = SequenceUtils.getDateId("P");
        String noPrefixDateId = SequenceUtils.getDateId("P", false);
        String paddedDateId = SequenceUtils.getPaddedDateId("P", true);

        String deprecatedDateTimeId = SequenceUtils.getDateTimeId();
        String prefixedDateTimeId = SequenceUtils.getDateTimeId("DT");
        String noPrefixDateTimeId = SequenceUtils.getDateTimeId("DT", false);
        String paddedDateTimeId = SequenceUtils.getPaddedDateTimeId("DT", true);

        assertTrue(dateIdPattern.matcher(deprecatedDateId).matches());
        assertTrue(prefixedDateId.startsWith("P"));
        assertTrue(dateIdPattern.matcher(prefixedDateId).matches());
        assertTrue(dateIdPattern.matcher(noPrefixDateId).matches());
        assertTrue(paddedDateId.startsWith("P"));

        assertTrue(dateTimeIdPattern.matcher(deprecatedDateTimeId).matches());
        assertTrue(prefixedDateTimeId.startsWith("DT"));
        assertTrue(dateTimeIdPattern.matcher(prefixedDateTimeId).matches());
        assertTrue(dateTimeIdPattern.matcher(noPrefixDateTimeId).matches());
        assertTrue(paddedDateTimeId.startsWith("DT"));
    }
}
