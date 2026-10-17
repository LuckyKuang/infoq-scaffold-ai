package cc.infoq.common.web.config;

import cc.infoq.common.web.filter.RepeatableFilter;
import cc.infoq.common.web.filter.XssFilter;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;

@Tag("dev")
class FilterConfigTest {

    @Test
    @DisplayName("filter beans: should create xss and repeatable filters")
    void filterBeansShouldCreateXssAndRepeatableFilters() {
        FilterConfig filterConfig = new FilterConfig();

        XssFilter xssFilter = filterConfig.xssFilter();
        RepeatableFilter repeatableFilter = filterConfig.repeatableFilter();

        assertNotNull(xssFilter);
        assertNotNull(repeatableFilter);
        assertInstanceOf(XssFilter.class, xssFilter);
        assertInstanceOf(RepeatableFilter.class, repeatableFilter);
    }
}
