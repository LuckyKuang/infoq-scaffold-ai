package cc.infoq.system.domain.vo;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertFalse;

@Tag("dev")
class ServerMonitorVoContractTest {

    @Test
    @DisplayName("server monitor contract should not expose sensitive host and jvm fields")
    void serverMonitorContractShouldNotExposeSensitiveHostAndJvmFields() {
        Set<String> jvmFields = fieldNames(ServerMonitorVo.Jvm.class);
        Set<String> sysFields = fieldNames(ServerMonitorVo.Sys.class);

        assertFalse(jvmFields.contains("home"));
        assertFalse(jvmFields.contains("inputArgs"));
        assertFalse(sysFields.contains("computerName"));
        assertFalse(sysFields.contains("computerIp"));
        assertFalse(sysFields.contains("userDir"));
    }

    private Set<String> fieldNames(Class<?> type) {
        return Arrays.stream(type.getDeclaredFields())
            .map(Field::getName)
            .collect(Collectors.toSet());
    }
}
