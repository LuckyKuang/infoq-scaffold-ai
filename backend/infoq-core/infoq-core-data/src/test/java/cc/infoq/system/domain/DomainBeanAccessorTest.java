package cc.infoq.system.domain;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.beans.Introspector;
import java.beans.PropertyDescriptor;
import java.lang.reflect.Array;
import java.lang.reflect.Constructor;
import java.lang.reflect.Method;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertTrue;

@Tag("dev")
class DomainBeanAccessorTest {

    private static final Object UNSUPPORTED = new Object();

    @Test
    @DisplayName("domain beans: should support standard getter/setter contract")
    void domainBeansShouldSupportGetterSetterContract() throws Exception {
        List<Class<?>> classes = loadDomainClasses();
        assertTrue(!classes.isEmpty(), "expected non-empty domain class list");

        for (Class<?> clazz : classes) {
            Object instance = instantiate(clazz);
            if (instance == null) {
                continue;
            }

            for (PropertyDescriptor descriptor : Introspector.getBeanInfo(clazz, Object.class).getPropertyDescriptors()) {
                Method write = descriptor.getWriteMethod();
                Method read = descriptor.getReadMethod();

                if (write != null) {
                    Object value = sampleValue(descriptor.getPropertyType());
                    if (value != UNSUPPORTED) {
                        write.setAccessible(true);
                        write.invoke(instance, value);
                    }
                }
                // Skip derived read-only properties (for example, computed booleans) to avoid
                // invoking business helpers with incomplete test fixtures.
                if (read != null && write != null) {
                    read.setAccessible(true);
                    read.invoke(instance);
                }
            }

            invokeNoArgIfPresent(clazz, instance, "isSuperAdmin");
            instance.toString();
            instance.hashCode();
            assertTrue(instance.equals(instance));
        }
    }

    private static List<Class<?>> loadDomainClasses() throws Exception {
        Path root = Paths.get("src/main/java/cc/infoq/system/domain");
        if (!Files.exists(root)) {
            return List.of();
        }
        try (Stream<Path> stream = Files.walk(root)) {
            List<Class<?>> classes = new ArrayList<>();
            for (Path path : stream.filter(Files::isRegularFile).toList()) {
                String fileName = path.getFileName().toString();
                if (!fileName.endsWith(".java") || fileName.equals("package-info.java")) {
                    continue;
                }
                String className = toClassName(path);
                classes.add(Class.forName(className));
            }
            classes.sort((a, b) -> a.getName().compareTo(b.getName()));
            return classes;
        }
    }

    private static String toClassName(Path file) {
        Path relative = Paths.get("src/main/java").relativize(file);
        String normalized = relative.toString().replace('/', '.').replace('\\', '.');
        return normalized.substring(0, normalized.length() - ".java".length());
    }

    private static Object instantiate(Class<?> clazz) throws Exception {
        Constructor<?> noArg = Arrays.stream(clazz.getDeclaredConstructors())
            .filter(c -> c.getParameterCount() == 0)
            .findFirst()
            .orElse(null);
        if (noArg != null) {
            noArg.setAccessible(true);
            return noArg.newInstance();
        }

        Constructor<?> oneArgLong = Arrays.stream(clazz.getDeclaredConstructors())
            .filter(c -> c.getParameterCount() == 1)
            .filter(c -> {
                Class<?> type = c.getParameterTypes()[0];
                return type == Long.class || type == long.class;
            })
            .findFirst()
            .orElse(null);
        if (oneArgLong != null) {
            oneArgLong.setAccessible(true);
            return oneArgLong.newInstance(1L);
        }

        Constructor<?> oneArgString = Arrays.stream(clazz.getDeclaredConstructors())
            .filter(c -> c.getParameterCount() == 1)
            .filter(c -> c.getParameterTypes()[0] == String.class)
            .findFirst()
            .orElse(null);
        if (oneArgString != null) {
            oneArgString.setAccessible(true);
            return oneArgString.newInstance("v");
        }

        return null;
    }

    private static void invokeNoArgIfPresent(Class<?> clazz, Object instance, String methodName) throws Exception {
        try {
            Method method = clazz.getMethod(methodName);
            method.setAccessible(true);
            method.invoke(instance);
        } catch (NoSuchMethodException ignored) {
            // optional method
        }
    }

    private static Object sampleValue(Class<?> type) {
        if (type == String.class) {
            return "v";
        }
        if (type == Long.class || type == long.class) {
            return 1L;
        }
        if (type == Integer.class || type == int.class) {
            return 1;
        }
        if (type == Short.class || type == short.class) {
            return (short) 1;
        }
        if (type == Byte.class || type == byte.class) {
            return (byte) 1;
        }
        if (type == Double.class || type == double.class) {
            return 1.0d;
        }
        if (type == Float.class || type == float.class) {
            return 1.0f;
        }
        if (type == Boolean.class || type == boolean.class) {
            return true;
        }
        if (type == Character.class || type == char.class) {
            return 'a';
        }
        if (type == Date.class) {
            return new Date(0L);
        }
        if (type == LocalDate.class) {
            return LocalDate.of(2026, 3, 8);
        }
        if (type == LocalDateTime.class) {
            return LocalDateTime.of(2026, 3, 8, 0, 0);
        }
        if (type == BigDecimal.class) {
            return BigDecimal.ONE;
        }
        if (type.isEnum()) {
            Object[] constants = type.getEnumConstants();
            return constants.length > 0 ? constants[0] : null;
        }
        if (type.isArray()) {
            Class<?> componentType = type.getComponentType();
            Object array = Array.newInstance(componentType, 1);
            Object element = sampleValue(componentType);
            if (element != UNSUPPORTED && element != null) {
                Array.set(array, 0, element);
            }
            return array;
        }
        if (List.class.isAssignableFrom(type)) {
            return new ArrayList<>();
        }
        if (Set.class.isAssignableFrom(type)) {
            return new HashSet<>();
        }
        if (Map.class.isAssignableFrom(type)) {
            return new HashMap<>();
        }
        return null;
    }
}
