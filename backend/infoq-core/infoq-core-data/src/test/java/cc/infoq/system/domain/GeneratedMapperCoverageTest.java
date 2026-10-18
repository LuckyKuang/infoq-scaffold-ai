package cc.infoq.system.domain;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Array;
import java.lang.reflect.Constructor;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.Comparator;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertTrue;

@Tag("dev")
class GeneratedMapperCoverageTest {

    private static final Object UNSUPPORTED = new Object();

    @Test
    @DisplayName("generated mapper impls: should execute convert methods without exception")
    void generatedMapperImplsShouldExecuteConvertMethods() throws Exception {
        List<Class<?>> mapperImplClasses = loadMapperImplClasses();
        assertTrue(!mapperImplClasses.isEmpty(), "expected generated mapper impl classes");

        List<String> failures = new ArrayList<>();
        int invokedMethods = 0;
        for (Class<?> mapperImplClass : mapperImplClasses) {
            Object mapper = instantiate(mapperImplClass);
            if (mapper == null) {
                continue;
            }
            for (Method method : mapperImplClass.getMethods()) {
                if (!method.getName().equals("convert")) {
                    continue;
                }
                if (method.isBridge() || method.isSynthetic()) {
                    continue;
                }
                if (Modifier.isStatic(method.getModifiers()) || method.getDeclaringClass() == Object.class) {
                    continue;
                }
                Object[] args = sampleArgs(method.getParameterTypes());
                if (args == null) {
                    continue;
                }
                try {
                    method.setAccessible(true);
                    method.invoke(mapper, args);
                    invokedMethods++;
                } catch (InvocationTargetException ex) {
                    Throwable target = ex.getTargetException();
                    failures.add(mapperImplClass.getName() + "#" + method + " -> " + target.getClass().getSimpleName() + ": " + target.getMessage());
                }
            }
        }

        assertTrue(invokedMethods > 0, "expected at least one convert invocation");
        assertTrue(failures.isEmpty(), String.join("\n", failures));
    }

    @Test
    @DisplayName("generated converter adapters: should instantiate mapstruct-plus adapter classes")
    void generatedConverterAdaptersShouldInstantiate() throws Exception {
        List<Class<?>> adapterClasses = loadConverterAdapterClasses();
        int instantiated = 0;
        for (Class<?> adapterClass : adapterClasses) {
            Object instance = instantiate(adapterClass);
            if (instance != null) {
                instantiated++;
            }
        }
        assertTrue(instantiated > 0, "expected at least one ConverterMapperAdapter class");
    }

    private static List<Class<?>> loadMapperImplClasses() throws Exception {
        Path classesRoot = Paths.get("target/classes");
        Path packageRoot = classesRoot.resolve("cc/infoq");
        if (!Files.exists(packageRoot)) {
            return List.of();
        }
        try (Stream<Path> stream = Files.walk(packageRoot)) {
            List<Class<?>> classes = new ArrayList<>();
            for (Path file : stream.filter(Files::isRegularFile).toList()) {
                String normalized = file.toString().replace('\\', '/');
                if (!normalized.endsWith("MapperImpl.class")) {
                    continue;
                }
                if (normalized.contains("$")) {
                    continue;
                }
                String className = toClassName(classesRoot, file);
                classes.add(Class.forName(className));
            }
            classes.sort(Comparator.comparing(Class::getName));
            return classes;
        }
    }

    private static List<Class<?>> loadConverterAdapterClasses() throws Exception {
        Path classesRoot = Paths.get("target/classes");
        Path packageRoot = classesRoot.resolve("io/github/linpeilie");
        if (!Files.exists(packageRoot)) {
            return List.of();
        }
        try (Stream<Path> stream = Files.walk(packageRoot)) {
            List<Class<?>> classes = new ArrayList<>();
            for (Path file : stream.filter(Files::isRegularFile).toList()) {
                String normalized = file.toString().replace('\\', '/');
                if (!normalized.endsWith(".class")) {
                    continue;
                }
                if (!normalized.contains("ConverterMapperAdapter__")) {
                    continue;
                }
                if (normalized.contains("$")) {
                    continue;
                }
                classes.add(Class.forName(toClassName(classesRoot, file)));
            }
            classes.sort(Comparator.comparing(Class::getName));
            return classes;
        }
    }

    private static String toClassName(Path classesRoot, Path classFile) {
        String relative = classesRoot.relativize(classFile).toString().replace('\\', '.').replace('/', '.');
        return relative.substring(0, relative.length() - ".class".length());
    }

    private static Object[] sampleArgs(Class<?>[] parameterTypes) throws Exception {
        Object[] args = new Object[parameterTypes.length];
        for (int i = 0; i < parameterTypes.length; i++) {
            Object value = sampleValue(parameterTypes[i], 0);
            if (value == UNSUPPORTED) {
                return null;
            }
            args[i] = value;
        }
        return args;
    }

    private static Object sampleValue(Class<?> type, int depth) throws Exception {
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
            return 1d;
        }
        if (type == Float.class || type == float.class) {
            return 1f;
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
        if (type.isEnum()) {
            Object[] enumConstants = type.getEnumConstants();
            return enumConstants.length > 0 ? enumConstants[0] : null;
        }
        if (type.isArray()) {
            Class<?> componentType = type.getComponentType();
            Object value = sampleValue(componentType, depth + 1);
            Object array = Array.newInstance(componentType, 1);
            if (value != UNSUPPORTED && value != null) {
                Array.set(array, 0, value);
            }
            return array;
        }
        if (Map.class.isAssignableFrom(type)) {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("k", "v");
            return map;
        }
        if (Set.class.isAssignableFrom(type)) {
            Set<Object> set = new LinkedHashSet<>();
            set.add("v");
            return set;
        }
        if (List.class.isAssignableFrom(type)) {
            return new ArrayList<>();
        }
        if (Collection.class.isAssignableFrom(type)) {
            return new ArrayList<>();
        }
        if (type.isInterface() || Modifier.isAbstract(type.getModifiers()) || depth > 1) {
            return null;
        }

        Object instance = instantiate(type);
        if (instance == null) {
            return UNSUPPORTED;
        }

        for (Method method : type.getMethods()) {
            if (!method.getName().startsWith("set") || method.getParameterCount() != 1) {
                continue;
            }
            if (!Modifier.isPublic(method.getModifiers())) {
                continue;
            }
            Class<?> parameterType = method.getParameterTypes()[0];
            Object value = sampleValue(parameterType, depth + 1);
            if (value == UNSUPPORTED) {
                continue;
            }
            method.invoke(instance, value);
        }

        return instance;
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
}
