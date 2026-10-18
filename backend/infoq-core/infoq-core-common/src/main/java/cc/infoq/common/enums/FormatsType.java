package cc.infoq.common.enums;

import cc.infoq.common.utils.StringUtils;
import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * 日期格式与时间格式枚举
 */
@Getter
@AllArgsConstructor
public enum FormatsType {

    /**
     * 例如：2023年表示为"23"
     */
    YY("yy"),

    /**
     * 例如：2023年表示为"2023"
     */
    YYYY("yyyy"),

    /**
     * 例如，2023年7月可以表示为 "2023-07"
     */
    YYYY_MM("yyyy-MM"),

    /**
     * 例如，日期 "2023年7月22日" 可以表示为 "2023-07-22"
     */
    YYYY_MM_DD("yyyy-MM-dd"),

    /**
     * 例如，当前时间如果是 "2023年7月22日下午3点30分"，则可以表示为 "2023-07-22 15:30"
     */
    YYYY_MM_DD_HH_MM("yyyy-MM-dd HH:mm"),

    /**
     * 例如，当前时间如果是 "2023年7月22日下午3点30分45秒"，则可以表示为 "2023-07-22 15:30:45"
     */
    YYYY_MM_DD_HH_MM_SS("yyyy-MM-dd HH:mm:ss"),

    /**
     * 例如：下午3点30分45秒，表示为 "15:30:45"
     */
    HH_MM_SS("HH:mm:ss"),

    /**
     * 例如，2023年7月可以表示为 "2023/07"
     */
    YYYY_MM_SLASH("yyyy/MM"),

    /**
     * 例如，日期 "2023年7月22日" 可以表示为 "2023/07/22"
     */
    YYYY_MM_DD_SLASH("yyyy/MM/dd"),

    /**
     * 例如，当前时间如果是 "2023年7月22日下午3点30分"，则可以表示为 "2023/07/22 15:30"
     */
    YYYY_MM_DD_HH_MM_SLASH("yyyy/MM/dd HH:mm"),

    /**
     * 例如，当前时间如果是 "2023年7月22日下午3点30分45秒"，则可以表示为 "2023/07/22 15:30:45"
     */
    YYYY_MM_DD_HH_MM_SS_SLASH("yyyy/MM/dd HH:mm:ss"),

    /**
     * 例如，2023年7月可以表示为 "2023.07"
     */
    YYYY_MM_DOT("yyyy.MM"),

    /**
     * 例如，日期 "2023年7月22日" 可以表示为 "2023.07.22"
     */
    YYYY_MM_DD_DOT("yyyy.MM.dd"),

    /**
     * 例如，当前时间如果是 "2023年7月22日下午3点30分"，则可以表示为 "2023.07.22 15:30"
     */
    YYYY_MM_DD_HH_MM_DOT("yyyy.MM.dd HH:mm"),

    /**
     * 例如，当前时间如果是 "2023年7月22日下午3点30分45秒"，则可以表示为 "2023.07.22 15:30:45"
     */
    YYYY_MM_DD_HH_MM_SS_DOT("yyyy.MM.dd HH:mm:ss"),

    /**
     * 例如，2023年7月可以表示为 "202307"
     */
    YYYYMM("yyyyMM"),

    /**
     * 例如，2023年7月22日可以表示为 "20230722"
     */
    YYYYMMDD("yyyyMMdd"),

    /**
     * 例如，2023年7月22日下午3点可以表示为 "2023072215"
     */
    YYYYMMDDHH("yyyyMMddHH"),

    /**
     * 例如，2023年7月22日下午3点30分可以表示为 "202307221530"
     */
    YYYYMMDDHHMM("yyyyMMddHHmm"),

    /**
     * 例如，2023年7月22日下午3点30分45秒可以表示为 "20230722153045"
     */
    YYYYMMDDHHMMSS("yyyyMMddHHmmss");

    /**
     * 时间格式
     */
    private final String timeFormat;

    public static FormatsType getFormatsType(String str) {
        FormatsType matched = null;
        for (FormatsType value : values()) {
            String timeFormat = value.getTimeFormat();
            if (StringUtils.equals(str, timeFormat)) {
                return value;
            }
            if (StringUtils.contains(str, timeFormat)
                && (matched == null || timeFormat.length() > matched.getTimeFormat().length())) {
                matched = value;
            }
        }
        if (matched != null) {
            return matched;
        }
        throw new RuntimeException("'FormatsType' not found By " + str);
    }
}
