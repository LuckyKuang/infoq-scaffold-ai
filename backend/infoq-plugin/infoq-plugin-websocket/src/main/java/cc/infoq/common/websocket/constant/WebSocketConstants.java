package cc.infoq.common.websocket.constant;

/**
 * websocket的常量配置
 *
 * @author Pontus
 */
public interface WebSocketConstants {

    /**
     * websocketSession中的参数的key
     */
    String LOGIN_USER_KEY = "loginUser";

    /**
     * 订阅的频道
     */
    String WEB_SOCKET_TOPIC = "global:websocket";

    /**
     * 节点定向消息频道前缀
     */
    String WEB_SOCKET_NODE_TOPIC_PREFIX = WEB_SOCKET_TOPIC + ":node:";

    /**
     * 用户到节点的共享注册表前缀
     */
    String WEB_SOCKET_USER_NODE_SET_PREFIX = WEB_SOCKET_TOPIC + ":user:nodes:";

    /**
     * 节点到用户的反向索引前缀
     */
    String WEB_SOCKET_NODE_USER_SET_PREFIX = WEB_SOCKET_TOPIC + ":node:users:";

    /**
     * 节点心跳 key 前缀
     */
    String WEB_SOCKET_NODE_HEARTBEAT_KEY_PREFIX = WEB_SOCKET_TOPIC + ":node:heartbeat:";

    /**
     * 前端心跳检查的命令
     */
    String PING = "ping";

    /**
     * 服务端心跳恢复的字符串
     */
    String PONG = "pong";
}
