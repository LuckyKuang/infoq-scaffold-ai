package cc.infoq.common.utils;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertIterableEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Tag("dev")
class StreamUtilsTest {

    @Test
    @DisplayName("filter/find helpers: should handle normal and empty collections")
    void filterAndFindHelpersShouldWork() {
        List<Integer> values = List.of(1, 2, 3, 4);
        assertIterableEquals(List.of(2, 4), StreamUtils.filter(values, value -> value % 2 == 0));
        assertEquals(3, StreamUtils.findFirstValue(values, value -> value > 2));
        assertNull(StreamUtils.findAnyValue(List.of(), value -> true));
    }

    @Test
    @DisplayName("join/sorted: should filter null and produce deterministic output")
    void joinAndSortedShouldWork() {
        String joined = StreamUtils.join(Arrays.asList("a", null, "c"), value -> value, "|");
        List<Integer> sorted = StreamUtils.sorted(Arrays.asList(4, null, 2, 3), Comparator.naturalOrder());

        assertEquals("a|c", joined);
        assertIterableEquals(List.of(2, 3, 4), sorted);
    }

    @Test
    @DisplayName("map/group conversion: should keep first duplicate value and support grouping")
    void mapAndGroupConvertersShouldWork() {
        record User(Long id, String dept, String name) {}
        List<User> users = List.of(
            new User(1L, "D1", "A"),
            new User(2L, "D1", "B"),
            new User(2L, "D1", "B2")
        );

        Map<Long, User> idMap = StreamUtils.toIdentityMap(users, User::id);
        Map<Long, String> nameMap = StreamUtils.toMap(users, User::id, User::name);
        Map<String, List<User>> grouped = StreamUtils.groupByKey(users, User::dept);
        Map<String, Map<Long, User>> groupedMap = StreamUtils.group2Map(users, User::dept, User::id);
        Set<String> names = StreamUtils.toSet(users, User::name);

        assertEquals("B", idMap.get(2L).name());
        assertEquals("B", nameMap.get(2L));
        assertEquals(3, grouped.get("D1").size());
        assertEquals("B", groupedMap.get("D1").get(2L).name());
        assertTrue(names.contains("A"));
    }

    @Test
    @DisplayName("merge: should support empty-map and two-map merge branches")
    void mergeShouldSupportAllBranches() {
        Map<String, Integer> map1 = new LinkedHashMap<>();
        map1.put("a", 1);
        Map<String, Integer> map2 = new LinkedHashMap<>();
        map2.put("b", 2);
        map2.put("a", 3);

        Map<String, String> merged = StreamUtils.merge(map1, map2, (x, y) -> x + ":" + y);
        Map<String, String> onlyMap2 = StreamUtils.merge(Map.of(), map2, (x, y) -> x + ":" + y);
        Map<String, String> onlyMap1 = StreamUtils.merge(map1, Map.of(), (x, y) -> x + ":" + y);
        Map<String, String> bothEmpty = StreamUtils.merge(Map.of(), Map.of(), (x, y) -> "n/a");

        assertEquals("1:3", merged.get("a"));
        assertEquals("null:2", onlyMap2.get("b"));
        assertEquals("1:null", onlyMap1.get("a"));
        assertFalse(bothEmpty.containsKey("any"));
    }

    @Test
    @DisplayName("groupBy2Key/toList/toMap(map): should support nested grouping and mapped values")
    void groupBy2KeyAndToListShouldWork() {
        record Student(String grade, String clazz, String name, Integer score) {}
        List<Student> students = List.of(
            new Student("G1", "C1", "A", 90),
            new Student("G1", "C1", "B", 95),
            new Student("G1", "C2", "C", 80)
        );

        Map<String, Map<String, List<Student>>> grouped = StreamUtils.groupBy2Key(students, Student::grade, Student::clazz);
        List<String> names = StreamUtils.toList(students, Student::name);
        Map<String, Integer> scoreMap = StreamUtils.toMap(Map.of("A", 90, "B", 95), (k, v) -> v + 5);

        assertEquals(2, grouped.get("G1").size());
        assertIterableEquals(List.of("A", "B", "C"), names);
        assertEquals(95, scoreMap.get("A"));
        assertEquals(100, scoreMap.get("B"));
    }
}
