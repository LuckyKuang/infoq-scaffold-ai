package cc.infoq.common.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * 设备类型
 *
 * @author Pontus
 */
@Getter
@AllArgsConstructor
public enum DeviceType {

    /**
     * pc端
     */
    PC("pc"),

    /**
     * app端
     */
    APP("app"),

    /**
     * 微信小程序端
     */
    MINIAPP("miniapp");

    /**
     * 设备标识
     */
    private final String device;
}
