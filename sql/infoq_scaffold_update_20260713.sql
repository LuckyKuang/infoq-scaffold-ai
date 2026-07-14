-- P1/P2: OAuth 身份关系与微信小程序登录。
-- 目标表：sys_client、sys_oauth_provider、sys_oauth_identity。
-- 执行后清理 Redis 键 global:sys_client#30d，使新增 xcx grant type 立即生效。

-- 为既有小程序客户端增加 xcx 授权类型；重复执行不重复追加。
UPDATE `sys_client`
SET `grant_type` = CASE
    WHEN FIND_IN_SET('xcx', REPLACE(`grant_type`, ' ', '')) > 0 THEN `grant_type`
    WHEN `grant_type` IS NULL OR `grant_type` = '' THEN 'xcx'
    ELSE CONCAT(`grant_type`, ',xcx')
END,
`update_time` = NOW()
WHERE `client_key` = 'weapp' AND `del_flag` = '0';

-- Provider 默认禁用；启用微信登录前必须同时配置 infoq.auth.wechat-miniapp 和该 Provider。
INSERT IGNORE INTO `sys_oauth_provider`
(`provider_id`, `provider_code`, `provider_name`, `enabled`, `allow_login`, `allow_bind`, `allow_auto_register`, `sort`, `remark`, `del_flag`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`)
VALUES
(9001, 'wechat_miniapp', '微信小程序', '1', '1', '1', '1', 100, '由部署配置控制，默认禁用', '0', 103, 1, NOW(), 1, NOW());

-- 验证查询：
-- SELECT client_id, client_key, grant_type FROM sys_client WHERE client_key = 'weapp' AND del_flag = '0';
-- SELECT provider_code, enabled, allow_login, allow_bind, allow_auto_register FROM sys_oauth_provider WHERE provider_code = 'wechat_miniapp';

-- 回滚说明：若未创建任何微信身份记录，可手动移除 xcx grant 并删除 Provider；
-- 已有 sys_oauth_identity.provider_code='wechat_miniapp' 记录时，仅关闭 Provider 和配置开关，不删除历史身份数据。

-- P3: 持久化消息盒子。消息正文与接收人状态分表，接收人删除为软删除状态。
CREATE TABLE IF NOT EXISTS `sys_message` (
    `message_id` bigint NOT NULL COMMENT '消息ID',
    `message_type` varchar(32) NOT NULL COMMENT '消息类型',
    `message_level` varchar(16) NOT NULL DEFAULT 'info' COMMENT '消息级别',
    `title` varchar(200) NOT NULL COMMENT '标题',
    `content` text COMMENT '正文',
    `source` varchar(64) NOT NULL COMMENT '来源',
    `business_key` varchar(128) DEFAULT NULL COMMENT '业务幂等键',
    `expire_time` datetime DEFAULT NULL COMMENT '过期时间',
    `create_dept` bigint DEFAULT NULL,
    `create_by` bigint DEFAULT NULL,
    `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `update_by` bigint DEFAULT NULL,
    `update_time` datetime DEFAULT NULL,
    PRIMARY KEY (`message_id`),
    UNIQUE KEY `uk_sys_message_business` (`source`, `business_key`),
    KEY `idx_sys_message_expire_time` (`expire_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统消息';

CREATE TABLE IF NOT EXISTS `sys_message_recipient` (
    `recipient_id` bigint NOT NULL COMMENT '接收记录ID',
    `message_id` bigint NOT NULL COMMENT '消息ID',
    `user_id` bigint NOT NULL COMMENT '接收用户ID',
    `read_time` datetime DEFAULT NULL COMMENT '已读时间',
    `delete_time` datetime DEFAULT NULL COMMENT '删除时间',
    `create_dept` bigint DEFAULT NULL,
    `create_by` bigint DEFAULT NULL,
    `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `update_by` bigint DEFAULT NULL,
    `update_time` datetime DEFAULT NULL,
    PRIMARY KEY (`recipient_id`),
    UNIQUE KEY `uk_sys_message_recipient` (`message_id`, `user_id`),
    KEY `idx_sys_message_recipient_inbox` (`user_id`, `delete_time`, `read_time`, `message_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统消息接收人';

-- 对已创建过消息表的环境补充软删除清理索引；重复执行保持安全。
SET @message_recipient_delete_index_exists = (
    SELECT COUNT(*)
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'sys_message_recipient'
      AND index_name = 'idx_sys_message_recipient_delete_time'
);
SET @message_recipient_delete_index_sql = IF(
    @message_recipient_delete_index_exists = 0,
    'ALTER TABLE sys_message_recipient ADD INDEX idx_sys_message_recipient_delete_time (delete_time)',
    'SELECT 1'
);
PREPARE message_recipient_delete_index_stmt FROM @message_recipient_delete_index_sql;
EXECUTE message_recipient_delete_index_stmt;
DEALLOCATE PREPARE message_recipient_delete_index_stmt;

-- 验证查询：
-- SELECT COUNT(*) AS unread_count FROM sys_message_recipient WHERE user_id = ? AND read_time IS NULL AND delete_time IS NULL;
-- SELECT message_id, user_id, read_time, delete_time FROM sys_message_recipient WHERE user_id = ? ORDER BY message_id DESC LIMIT 20;
-- 默认暂停的每日清理任务；仅在任务启用且 infoq.message.cleanup.enabled=true 时才会实际清理。
INSERT INTO `sys_job` (`job_id`, `job_name`, `job_group`, `handler_key`, `handler_params`, `cron_expression`, `misfire_policy`, `concurrent`, `status`, `del_flag`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`)
SELECT 20260713001, '消息盒子清理任务', 'SYSTEM', 'system.message.cleanup', NULL, '0 30 3 * * ?', '3', '1', '1', '0', 103, 1, NOW(), 1, NOW(), '默认暂停；启用前必须确认消息保留期与 infoq.message.cleanup.enabled=true'
WHERE NOT EXISTS (SELECT 1 FROM `sys_job` WHERE `job_id` = 20260713001);

-- 回滚说明：先关闭 infoq.push.enabled 并下线公告消息生产入口；历史消息保留到保留期结束后再独立清理。
-- 清理任务默认暂停，并且仅在 infoq.message.cleanup.enabled=true 时运行；它不会删除未过期消息或未软删除收件记录。
