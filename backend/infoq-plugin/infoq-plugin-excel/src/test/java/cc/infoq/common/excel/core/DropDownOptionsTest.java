package cc.infoq.common.excel.core;

import cc.infoq.common.exception.ServiceException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Tag("dev")
class DropDownOptionsTest {

    @Test
    @DisplayName("createOptionValue/analyzeOptionValue: should compose and parse option tokens")
    void createOptionValueAndAnalyzeOptionValueShouldWork() {
        String option = DropDownOptions.createOptionValue("华东", "上海", "Pudong1");

        assertEquals("华东_上海_Pudong1", option);
        assertEquals(List.of("华东", "上海", "Pudong1"), DropDownOptions.analyzeOptionValue(option));
    }

    @Test
    @DisplayName("createOptionValue: should reject illegal symbols")
    void createOptionValueShouldRejectIllegalSymbols() {
        assertThrows(ServiceException.class, () -> DropDownOptions.createOptionValue("shanghai 1"));
    }

    @Test
    @DisplayName("createOptionValue: should reject numeric-first option")
    void createOptionValueShouldRejectNumericFirstOption() {
        assertThrows(ServiceException.class, () -> DropDownOptions.createOptionValue("1"));
    }

    @Test
    @DisplayName("buildLinkedOptions: should build parent-child linked map")
    void buildLinkedOptionsShouldBuildLinkedMap() {
        List<City> parents = List.of(
            new City(1, 0, "北京"),
            new City(2, 0, "上海")
        );
        List<City> children = List.of(
            new City(101, 1, "朝阳"),
            new City(102, 1, "海淀"),
            new City(201, 2, "浦东"),
            new City(999, 9, "忽略项")
        );

        DropDownOptions options = DropDownOptions.buildLinkedOptions(
            parents,
            0,
            children,
            1,
            City::id,
            City::parentId,
            city -> DropDownOptions.createOptionValue(city.name(), city.id())
        );

        assertEquals(0, options.getIndex());
        assertEquals(1, options.getNextIndex());
        assertEquals(2, options.getOptions().size());
        assertTrue(options.getOptions().contains("北京_1"));
        assertTrue(options.getOptions().contains("上海_2"));

        Map<String, List<String>> nextOptions = options.getNextOptions();
        assertEquals(List.of("朝阳_101", "海淀_102"), nextOptions.get("北京_1"));
        assertEquals(List.of("浦东_201"), nextOptions.get("上海_2"));
    }

    private record City(int id, int parentId, String name) {
    }
}
