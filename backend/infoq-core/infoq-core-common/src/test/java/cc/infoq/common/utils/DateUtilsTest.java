package cc.infoq.common.utils;

import cc.infoq.common.enums.FormatsType;
import cc.infoq.common.exception.ServiceException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Date;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Tag("dev")
class DateUtilsTest {

    @Test
    @DisplayName("difference/getDatePoor/getTimeDifference: should return expected values")
    void differenceAndFriendlyDiffShouldReturnExpectedValues() {
        Date start = DateUtils.parseDateTime(FormatsType.YYYY_MM_DD_HH_MM_SS, "2026-03-08 00:00:00");
        Date end = DateUtils.parseDateTime(FormatsType.YYYY_MM_DD_HH_MM_SS, "2026-03-10 03:04:05");

        assertEquals(2L, DateUtils.difference(start, end, TimeUnit.DAYS));
        assertEquals(51L, DateUtils.difference(start, end, TimeUnit.HOURS));
        assertEquals(3064L, DateUtils.difference(start, end, TimeUnit.MINUTES));
        assertEquals(183845L, DateUtils.difference(start, end, TimeUnit.SECONDS));
        assertEquals("2天 3小时 4分钟", DateUtils.getDatePoor(end, start));
        assertEquals("2天 3小时 4分钟 5秒", DateUtils.getTimeDifference(end, start));
    }

    @Test
    @DisplayName("parseDate/formatDateTime: should support parse and format helpers")
    void parseAndFormatShouldWork() {
        Date parsed = DateUtils.parseDate("2026-03-08 10:20:30");
        assertNotNull(parsed);
        assertEquals("2026-03-08", DateUtils.formatDate(parsed));
        assertTrue(DateUtils.formatDateTime(parsed).startsWith("2026-03-08"));
        assertNull(DateUtils.parseDate("not-a-date"));
    }

    @Test
    @DisplayName("now/date path helpers: should return non-empty formatted values")
    void nowAndDatePathHelpersShouldReturnExpectedFormats() {
        assertNotNull(DateUtils.getNowDate());
        assertNotNull(DateUtils.getServerStartDate());
        assertTrue(DateUtils.getDate().matches("\\d{4}-\\d{2}-\\d{2}"));
        assertTrue(DateUtils.getCurrentDate().matches("\\d{8}"));
        assertTrue(DateUtils.datePath().matches("\\d{4}/\\d{2}/\\d{2}"));
        assertTrue(DateUtils.getTime().matches("\\d{4}-\\d{2}-\\d{2} .*"));
        assertTrue(DateUtils.getTimeWithHourMinuteSecond().matches("\\d{2}:\\d{2}:\\d{2}"));
        assertTrue(DateUtils.dateTimeNow().matches("\\d{14}"));
        assertTrue(DateUtils.dateTimeNow(FormatsType.YYYY_MM_DD_HH_MM).matches("\\d{4}-\\d{2}-\\d{2} .*"));
    }

    @Test
    @DisplayName("toDate: should convert LocalDateTime and LocalDate")
    void toDateShouldConvertTemporalValues() {
        Date fromDateTime = DateUtils.toDate(LocalDateTime.of(2026, 3, 8, 9, 30, 0));
        Date fromDate = DateUtils.toDate(LocalDate.of(2026, 3, 8));

        assertEquals("2026-03-08 09:30", DateUtils.parseDateToStr(FormatsType.YYYY_MM_DD_HH_MM, fromDateTime));
        assertEquals("2026-03-08", DateUtils.parseDateToStr(FormatsType.YYYY_MM_DD, fromDate));
    }

    @Test
    @DisplayName("validateDateRange: should enforce start/end ordering and max span")
    void validateDateRangeShouldEnforceRules() {
        Date start = DateUtils.parseDateTime(FormatsType.YYYY_MM_DD_HH_MM_SS, "2026-03-10 00:00:00");
        Date end = DateUtils.parseDateTime(FormatsType.YYYY_MM_DD_HH_MM_SS, "2026-03-08 00:00:00");
        assertThrows(ServiceException.class, () -> DateUtils.validateDateRange(start, end, 1, TimeUnit.DAYS));

        Date validStart = DateUtils.parseDateTime(FormatsType.YYYY_MM_DD_HH_MM_SS, "2026-03-01 00:00:00");
        Date validEnd = DateUtils.parseDateTime(FormatsType.YYYY_MM_DD_HH_MM_SS, "2026-03-02 00:00:00");
        assertDoesNotThrow(() -> DateUtils.validateDateRange(validStart, validEnd, 2, TimeUnit.DAYS));
        assertThrows(ServiceException.class, () -> DateUtils.validateDateRange(validStart, validEnd, 12, TimeUnit.HOURS));
    }

    @Test
    @DisplayName("getTodayHour: should map hour ranges correctly")
    void getTodayHourShouldMapRanges() {
        LocalDate day = LocalDate.of(2026, 3, 8);
        assertEquals("凌晨", DateUtils.getTodayHour(asDate(day, 5, 0)));
        assertEquals("上午", DateUtils.getTodayHour(asDate(day, 9, 0)));
        assertEquals("中午", DateUtils.getTodayHour(asDate(day, 12, 0)));
        assertEquals("下午", DateUtils.getTodayHour(asDate(day, 16, 0)));
        assertEquals("晚上", DateUtils.getTodayHour(asDate(day, 20, 0)));
    }

    @Test
    @DisplayName("formatFriendlyTime: should handle null/future/today/yesterday/past-year branches")
    void formatFriendlyTimeShouldHandleCommonBranches() {
        assertEquals("", DateUtils.formatFriendlyTime(null));

        Date now = new Date();
        assertEquals("刚刚", DateUtils.formatFriendlyTime(now));

        Date fiveMinutesAgo = new Date(now.getTime() - TimeUnit.MINUTES.toMillis(5));
        String fiveMinutesAgoText = DateUtils.formatFriendlyTime(fiveMinutesAgo);
        assertTrue(
            fiveMinutesAgoText.endsWith("分钟前") || fiveMinutesAgoText.startsWith("昨天 "),
            "跨午夜时 now-5分钟 会落在昨天，预期应兼容昨天分支"
        );

        Date yesterday = new Date(now.getTime() - TimeUnit.DAYS.toMillis(1));
        assertTrue(DateUtils.formatFriendlyTime(yesterday).startsWith("昨天 "));

        Date future = new Date(now.getTime() + TimeUnit.DAYS.toMillis(1));
        assertTrue(DateUtils.formatFriendlyTime(future).matches("\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}"));

        Date oldYear = Date.from(LocalDate.of(2020, 1, 1).atStartOfDay(ZoneId.systemDefault()).toInstant());
        assertTrue(DateUtils.formatFriendlyTime(oldYear).startsWith("2020-01-01"));
    }

    private static Date asDate(LocalDate date, int hour, int minute) {
        return Date.from(date.atTime(hour, minute).atZone(ZoneId.systemDefault()).toInstant());
    }
}
