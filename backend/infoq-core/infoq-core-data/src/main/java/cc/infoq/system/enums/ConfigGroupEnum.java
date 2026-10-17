package cc.infoq.system.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.Arrays;
import java.util.Comparator;
import java.util.List;

/**
 * 参数配置中心固定分组
 *
 * @author Pontus
 */
@Getter
@AllArgsConstructor
public enum ConfigGroupEnum {

    ACCOUNT("account", "账号与登录", 10),
    THEME("theme", "界面与主题", 20),
    RESOURCE("resource", "资源与文件", 30),
    ADVANCED("advanced", "高级配置", 99);

    private final String key;

    private final String name;

    private final int displayOrder;

    public static ConfigGroupEnum resolve(String groupKey) {
        return Arrays.stream(values())
            .filter(item -> item.key.equals(groupKey))
            .findFirst()
            .orElse(ADVANCED);
    }

    public static boolean isKnown(String groupKey) {
        return Arrays.stream(values()).anyMatch(item -> item.key.equals(groupKey));
    }

    public static List<ConfigGroupEnum> orderedValues() {
        return Arrays.stream(values())
            .sorted(Comparator.comparingInt(ConfigGroupEnum::getDisplayOrder))
            .toList();
    }

}
