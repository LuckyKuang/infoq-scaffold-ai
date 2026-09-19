-- ========================================
-- InfoQ Scaffold v3.0.0 - 完整数据库脚本
-- 项目重构版本 - 合并所有历史更新
-- 生成时间: 2026-09-19
-- ========================================
-- 
-- 本脚本整合了以下历史版本:
-- - infoq_scaffold_2.0.0.sql (基础表结构与初始数据)
-- - infoq_scaffold_update_20260425.sql (定时任务模块)
-- - infoq_scaffold_update_20260429.sql (服务监控与连接池监控)
-- - infoq_scaffold_update_20260526.sql (系统配置增强)
-- - infoq_scaffold_update_20260529.sql (OAuth登录与身份绑定)
-- - infoq_scaffold_update_20260713.sql (微信小程序登录与消息盒子)
-- ========================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ========================================
-- 第一部分: 基础表结构与初始数据
-- 来源: infoq_scaffold_2.0.0.sql
-- ========================================


-- ----------------------------
-- Table structure for sys_client
-- ----------------------------
DROP TABLE IF EXISTS `sys_client`;
CREATE TABLE `sys_client` (
    `id` bigint NOT NULL COMMENT 'id',
    `client_id` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '客户端id',
    `client_key` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '客户端key',
    `client_secret` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '客户端秘钥',
    `grant_type` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '授权类型',
    `device_type` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '设备类型',
    `active_timeout` int DEFAULT '1800' COMMENT 'token活跃超时时间',
    `timeout` int DEFAULT '604800' COMMENT 'token固定超时',
    `status` char(1) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '0' COMMENT '状态（0正常 1停用）',
    `del_flag` char(1) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '0' COMMENT '删除标志（0代表存在 1代表删除）',
    `create_dept` bigint DEFAULT NULL COMMENT '创建部门',
    `create_by` bigint DEFAULT NULL COMMENT '创建者',
    `create_time` datetime DEFAULT NULL COMMENT '创建时间',
    `update_by` bigint DEFAULT NULL COMMENT '更新者',
    `update_time` datetime DEFAULT NULL COMMENT '更新时间',
    PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='系统授权表';

-- ----------------------------
-- Records of sys_client
-- ----------------------------
BEGIN;
INSERT INTO `sys_client` (`id`, `client_id`, `client_key`, `client_secret`, `grant_type`, `device_type`, `active_timeout`, `timeout`, `status`, `del_flag`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`) VALUES (1, 'e5cd7e4891bf95d1d19206ce24a7b32e', 'pc', 'pc123', 'password', 'pc', 1800, 604800, '0', '0', 103, 1, now(), 1, now());
INSERT INTO `sys_client` (`id`, `client_id`, `client_key`, `client_secret`, `grant_type`, `device_type`, `active_timeout`, `timeout`, `status`, `del_flag`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`) VALUES (2, '428a8310cd442757ae699df5d894f051', 'app', 'app123', 'password,email', 'android', 1800, 604800, '0', '0', 103, 1, now(), 1, now());
INSERT INTO `sys_client` (`id`, `client_id`, `client_key`, `client_secret`, `grant_type`, `device_type`, `active_timeout`, `timeout`, `status`, `del_flag`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`) VALUES (3, 'edda41a953c4a2604febf8a305b441ce', 'weapp', 'weapp123', 'password', 'weapp', 1800, 604800, '0', '0', 103, 1, now(), 1, now());
COMMIT;

-- ----------------------------
-- Table structure for sys_invite_code
-- ----------------------------
DROP TABLE IF EXISTS `sys_invite_code`;
CREATE TABLE `sys_invite_code` (
    `invite_id` bigint NOT NULL COMMENT '邀请码ID',
    `invite_code` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '邀请码',
    `status` char(1) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT '0' COMMENT '总状态（0未使用 1已使用 2已作废 3已过期）',
    `expire_time` datetime DEFAULT NULL COMMENT '过期时间',
    `used_user_id` bigint DEFAULT NULL COMMENT '使用人ID',
    `used_time` datetime DEFAULT NULL COMMENT '使用时间',
    `canceled_time` datetime DEFAULT NULL COMMENT '作废时间',
    `canceled_reason` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '作废原因',
    `remark` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '备注',
    `create_dept` bigint DEFAULT NULL COMMENT '创建部门',
    `create_by` bigint DEFAULT NULL COMMENT '创建者',
    `create_time` datetime DEFAULT NULL COMMENT '创建时间',
    `update_by` bigint DEFAULT NULL COMMENT '更新者',
    `update_time` datetime DEFAULT NULL COMMENT '更新时间',
    PRIMARY KEY (`invite_id`) USING BTREE,
    UNIQUE KEY `uk_sys_invite_code_code` (`invite_code`) USING BTREE,
    KEY `idx_sys_invite_code_status` (`status`) USING BTREE,
    KEY `idx_sys_invite_code_used_user_id` (`used_user_id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='邀请码表';

-- ----------------------------
-- Records of sys_invite_code
-- ----------------------------
BEGIN;
COMMIT;

-- ----------------------------
-- Table structure for sys_config
-- ----------------------------
DROP TABLE IF EXISTS `sys_config`;
CREATE TABLE `sys_config` (
    `config_id` bigint NOT NULL COMMENT '参数主键',
    `config_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '' COMMENT '参数名称',
    `config_key` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '' COMMENT '参数键名',
    `config_value` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '' COMMENT '参数键值',
    `config_type` char(1) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT 'N' COMMENT '系统内置（Y是 N否）',
    `create_dept` bigint DEFAULT NULL COMMENT '创建部门',
    `create_by` bigint DEFAULT NULL COMMENT '创建者',
    `create_time` datetime DEFAULT NULL COMMENT '创建时间',
    `update_by` bigint DEFAULT NULL COMMENT '更新者',
    `update_time` datetime DEFAULT NULL COMMENT '更新时间',
    `remark` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '备注',
    PRIMARY KEY (`config_id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='参数配置表';

-- ----------------------------
-- Records of sys_config
-- ----------------------------
BEGIN;
INSERT INTO `sys_config` (`config_id`, `config_name`, `config_key`, `config_value`, `config_type`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1, '主框架页-默认皮肤样式名称', 'sys.index.skinName', 'skin-purple', 'Y', 103, 1, now(), 1, now(), '蓝色 skin-blue、绿色 skin-green、紫色 skin-purple、红色 skin-red、黄色 skin-yellow');
INSERT INTO `sys_config` (`config_id`, `config_name`, `config_key`, `config_value`, `config_type`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (2, '用户管理-账号初始密码', 'sys.user.initPassword', '123456', 'Y', 103, 1, now(), NULL, now(), '初始化密码 123456');
INSERT INTO `sys_config` (`config_id`, `config_name`, `config_key`, `config_value`, `config_type`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (3, '主框架页-侧边栏主题', 'sys.index.sideTheme', 'theme-light', 'Y', 103, 1, now(), 1, now(), '深色主题theme-dark，浅色主题theme-light');
INSERT INTO `sys_config` (`config_id`, `config_name`, `config_key`, `config_value`, `config_type`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (5, '账号自助-是否开启用户注册功能', 'sys.account.registerUser', 'false', 'Y', 103, 1, now(), NULL, now(), '是否开启注册用户功能（true开启，false关闭）');
INSERT INTO `sys_config` (`config_id`, `config_name`, `config_key`, `config_value`, `config_type`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (6, '账号自助-是否开启忘记密码功能', 'sys.account.forgotPassword', 'false', 'Y', 103, 1, now(), NULL, now(), '是否开启忘记密码功能（true开启，false关闭）');
INSERT INTO `sys_config` (`config_id`, `config_name`, `config_key`, `config_value`, `config_type`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (11, 'OSS预览列表资源开关', 'sys.oss.previewListResource', 'true', 'Y', 103, 1, now(), NULL, now(), 'true:开启, false:关闭');
INSERT INTO `sys_config` (`config_id`, `config_name`, `config_key`, `config_value`, `config_type`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (7, '账号自助-是否开启邀请码注册功能', 'sys.account.inviteRegister', 'false', 'Y', 103, 1, now(), NULL, now(), '是否开启邀请码注册功能（true开启，false关闭）');
COMMIT;

-- ----------------------------
-- Table structure for sys_dept
-- ----------------------------
DROP TABLE IF EXISTS `sys_dept`;
CREATE TABLE `sys_dept` (
    `dept_id` bigint NOT NULL COMMENT '部门id',
    `parent_id` bigint DEFAULT '0' COMMENT '父部门id',
    `ancestors` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '' COMMENT '祖级列表',
    `dept_name` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '' COMMENT '部门名称',
    `dept_category` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '部门类别编码',
    `order_num` int DEFAULT '0' COMMENT '显示顺序',
    `leader` bigint DEFAULT NULL COMMENT '负责人',
    `phone` varchar(11) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '联系电话',
    `email` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '邮箱',
    `status` char(1) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '0' COMMENT '部门状态（0正常 1停用）',
    `del_flag` char(1) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '0' COMMENT '删除标志（0代表存在 1代表删除）',
    `create_dept` bigint DEFAULT NULL COMMENT '创建部门',
    `create_by` bigint DEFAULT NULL COMMENT '创建者',
    `create_time` datetime DEFAULT NULL COMMENT '创建时间',
    `update_by` bigint DEFAULT NULL COMMENT '更新者',
    `update_time` datetime DEFAULT NULL COMMENT '更新时间',
    PRIMARY KEY (`dept_id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='部门表';

-- ----------------------------
-- Records of sys_dept
-- ----------------------------
BEGIN;
INSERT INTO `sys_dept` (`dept_id`, `parent_id`, `ancestors`, `dept_name`, `dept_category`, `order_num`, `leader`, `phone`, `email`, `status`, `del_flag`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`) VALUES (100, 0, '0', '吊炸天有限公司', NULL, 0, NULL, '15888888888', 'xxx@qq.com', '0', '0', 103, 1, now(), 1, now());
INSERT INTO `sys_dept` (`dept_id`, `parent_id`, `ancestors`, `dept_name`, `dept_category`, `order_num`, `leader`, `phone`, `email`, `status`, `del_flag`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`) VALUES (101, 100, '0,100', '北京总公司', NULL, 1, NULL, '15888888888', 'xxx@qq.com', '0', '0', 103, 1, now(), 1, now());
INSERT INTO `sys_dept` (`dept_id`, `parent_id`, `ancestors`, `dept_name`, `dept_category`, `order_num`, `leader`, `phone`, `email`, `status`, `del_flag`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`) VALUES (102, 100, '0,100', '广州分公司', NULL, 2, NULL, '15888888888', 'xxx@qq.com', '0', '0', 103, 1, now(), 1, now());
INSERT INTO `sys_dept` (`dept_id`, `parent_id`, `ancestors`, `dept_name`, `dept_category`, `order_num`, `leader`, `phone`, `email`, `status`, `del_flag`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`) VALUES (103, 101, '0,100,101', '研发部门', NULL, 2, 1, '15888888888', 'xxx@qq.com', '0', '0', 103, 1, now(), 1, now());
INSERT INTO `sys_dept` (`dept_id`, `parent_id`, `ancestors`, `dept_name`, `dept_category`, `order_num`, `leader`, `phone`, `email`, `status`, `del_flag`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`) VALUES (104, 101, '0,100,101', '市场部门', NULL, 3, NULL, '15888888888', 'xxx@qq.com', '0', '0', 103, 1, now(), 1, now());
INSERT INTO `sys_dept` (`dept_id`, `parent_id`, `ancestors`, `dept_name`, `dept_category`, `order_num`, `leader`, `phone`, `email`, `status`, `del_flag`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`) VALUES (105, 101, '0,100,101', '测试部门', NULL, 3, NULL, '15888888888', 'xxx@qq.com', '0', '1', 103, 1, now(), 1, now());
INSERT INTO `sys_dept` (`dept_id`, `parent_id`, `ancestors`, `dept_name`, `dept_category`, `order_num`, `leader`, `phone`, `email`, `status`, `del_flag`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`) VALUES (106, 101, '0,100,101', '财务部门', NULL, 4, NULL, '15888888888', 'xxx@qq.com', '0', '0', 103, 1, now(), 1, now());
INSERT INTO `sys_dept` (`dept_id`, `parent_id`, `ancestors`, `dept_name`, `dept_category`, `order_num`, `leader`, `phone`, `email`, `status`, `del_flag`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`) VALUES (107, 101, '0,100,101', '运维部门', NULL, 5, NULL, '15888888888', 'xxx@qq.com', '0', '1', 103, 1, now(), 1, now());
INSERT INTO `sys_dept` (`dept_id`, `parent_id`, `ancestors`, `dept_name`, `dept_category`, `order_num`, `leader`, `phone`, `email`, `status`, `del_flag`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`) VALUES (108, 102, '0,100,102', '市场部门', NULL, 1, NULL, '15888888888', 'xxx@qq.com', '0', '0', 103, 1, now(), NULL, now());
INSERT INTO `sys_dept` (`dept_id`, `parent_id`, `ancestors`, `dept_name`, `dept_category`, `order_num`, `leader`, `phone`, `email`, `status`, `del_flag`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`) VALUES (109, 102, '0,100,102', '财务部门', NULL, 2, NULL, '15888888888', 'xxx@qq.com', '0', '0', 103, 1, now(), NULL, now());
INSERT INTO `sys_dept` (`dept_id`, `parent_id`, `ancestors`, `dept_name`, `dept_category`, `order_num`, `leader`, `phone`, `email`, `status`, `del_flag`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`) VALUES (110, 101, '0,100,101', '董事会', NULL, 1, NULL, '15888888888', 'xxx@qq.com', '0', '0', 103, 1, now(), 1, now());
INSERT INTO `sys_dept` (`dept_id`, `parent_id`, `ancestors`, `dept_name`, `dept_category`, `order_num`, `leader`, `phone`, `email`, `status`, `del_flag`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`) VALUES (111, 101, '0,100,101', '人事部门', NULL, 5, NULL, '15888888888', 'xxx@qq.com', '0', '0', 103, 1, now(), 1, now());
INSERT INTO `sys_dept` (`dept_id`, `parent_id`, `ancestors`, `dept_name`, `dept_category`, `order_num`, `leader`, `phone`, `email`, `status`, `del_flag`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`) VALUES (112, 101, '0,100,101', '其他', NULL, 6, NULL, '15888888888', 'xxx@qq.com', '0', '0', 103, 1, now(), 1, now());
COMMIT;

-- ----------------------------
-- Table structure for sys_dict_data
-- ----------------------------
DROP TABLE IF EXISTS `sys_dict_data`;
CREATE TABLE `sys_dict_data` (
    `dict_code` bigint NOT NULL COMMENT '字典编码',
    `dict_sort` int DEFAULT '0' COMMENT '字典排序',
    `dict_label` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '' COMMENT '字典标签',
    `dict_value` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '' COMMENT '字典键值',
    `dict_type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '' COMMENT '字典类型',
    `css_class` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '样式属性（其他样式扩展）',
    `list_class` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '表格回显样式',
    `is_default` char(1) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT 'N' COMMENT '是否默认（Y是 N否）',
    `create_dept` bigint DEFAULT NULL COMMENT '创建部门',
    `create_by` bigint DEFAULT NULL COMMENT '创建者',
    `create_time` datetime DEFAULT NULL COMMENT '创建时间',
    `update_by` bigint DEFAULT NULL COMMENT '更新者',
    `update_time` datetime DEFAULT NULL COMMENT '更新时间',
    `remark` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '备注',
    PRIMARY KEY (`dict_code`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='字典数据表';

-- ----------------------------
-- Records of sys_dict_data
-- ----------------------------
BEGIN;
INSERT INTO `sys_dict_data` (`dict_code`, `dict_sort`, `dict_label`, `dict_value`, `dict_type`, `css_class`, `list_class`, `is_default`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1, 1, '男', '0', 'sys_user_sex', '', '', 'Y', 103, 1, now(), NULL, now(), '性别男');
INSERT INTO `sys_dict_data` (`dict_code`, `dict_sort`, `dict_label`, `dict_value`, `dict_type`, `css_class`, `list_class`, `is_default`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (2, 2, '女', '1', 'sys_user_sex', '', '', 'N', 103, 1, now(), NULL, now(), '性别女');
INSERT INTO `sys_dict_data` (`dict_code`, `dict_sort`, `dict_label`, `dict_value`, `dict_type`, `css_class`, `list_class`, `is_default`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (3, 3, '未知', '2', 'sys_user_sex', '', '', 'N', 103, 1, now(), NULL, now(), '性别未知');
INSERT INTO `sys_dict_data` (`dict_code`, `dict_sort`, `dict_label`, `dict_value`, `dict_type`, `css_class`, `list_class`, `is_default`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (4, 1, '显示', '0', 'sys_show_hide', '', 'primary', 'Y', 103, 1, now(), NULL, now(), '显示菜单');
INSERT INTO `sys_dict_data` (`dict_code`, `dict_sort`, `dict_label`, `dict_value`, `dict_type`, `css_class`, `list_class`, `is_default`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (5, 2, '隐藏', '1', 'sys_show_hide', '', 'danger', 'N', 103, 1, now(), NULL, now(), '隐藏菜单');
INSERT INTO `sys_dict_data` (`dict_code`, `dict_sort`, `dict_label`, `dict_value`, `dict_type`, `css_class`, `list_class`, `is_default`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (6, 1, '正常', '0', 'sys_normal_disable', '', 'primary', 'Y', 103, 1, now(), NULL, now(), '正常状态');
INSERT INTO `sys_dict_data` (`dict_code`, `dict_sort`, `dict_label`, `dict_value`, `dict_type`, `css_class`, `list_class`, `is_default`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (7, 2, '停用', '1', 'sys_normal_disable', '', 'danger', 'N', 103, 1, now(), NULL, now(), '停用状态');
INSERT INTO `sys_dict_data` (`dict_code`, `dict_sort`, `dict_label`, `dict_value`, `dict_type`, `css_class`, `list_class`, `is_default`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (12, 1, '是', 'Y', 'sys_yes_no', '', 'primary', 'Y', 103, 1, now(), NULL, now(), '系统默认是');
INSERT INTO `sys_dict_data` (`dict_code`, `dict_sort`, `dict_label`, `dict_value`, `dict_type`, `css_class`, `list_class`, `is_default`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (13, 2, '否', 'N', 'sys_yes_no', '', 'danger', 'N', 103, 1, now(), NULL, now(), '系统默认否');
INSERT INTO `sys_dict_data` (`dict_code`, `dict_sort`, `dict_label`, `dict_value`, `dict_type`, `css_class`, `list_class`, `is_default`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (14, 1, '通知', '1', 'sys_notice_type', '', 'warning', 'Y', 103, 1, now(), NULL, now(), '通知');
INSERT INTO `sys_dict_data` (`dict_code`, `dict_sort`, `dict_label`, `dict_value`, `dict_type`, `css_class`, `list_class`, `is_default`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (15, 2, '公告', '2', 'sys_notice_type', '', 'success', 'N', 103, 1, now(), NULL, now(), '公告');
INSERT INTO `sys_dict_data` (`dict_code`, `dict_sort`, `dict_label`, `dict_value`, `dict_type`, `css_class`, `list_class`, `is_default`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (16, 1, '正常', '0', 'sys_notice_status', '', 'primary', 'Y', 103, 1, now(), NULL, now(), '正常状态');
INSERT INTO `sys_dict_data` (`dict_code`, `dict_sort`, `dict_label`, `dict_value`, `dict_type`, `css_class`, `list_class`, `is_default`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (17, 2, '关闭', '1', 'sys_notice_status', '', 'danger', 'N', 103, 1, now(), NULL, now(), '关闭状态');
INSERT INTO `sys_dict_data` (`dict_code`, `dict_sort`, `dict_label`, `dict_value`, `dict_type`, `css_class`, `list_class`, `is_default`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (18, 1, '新增', '1', 'sys_oper_type', '', 'info', 'N', 103, 1, now(), NULL, now(), '新增操作');
INSERT INTO `sys_dict_data` (`dict_code`, `dict_sort`, `dict_label`, `dict_value`, `dict_type`, `css_class`, `list_class`, `is_default`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (19, 2, '修改', '2', 'sys_oper_type', '', 'info', 'N', 103, 1, now(), NULL, now(), '修改操作');
INSERT INTO `sys_dict_data` (`dict_code`, `dict_sort`, `dict_label`, `dict_value`, `dict_type`, `css_class`, `list_class`, `is_default`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (20, 3, '删除', '3', 'sys_oper_type', '', 'danger', 'N', 103, 1, now(), NULL, now(), '删除操作');
INSERT INTO `sys_dict_data` (`dict_code`, `dict_sort`, `dict_label`, `dict_value`, `dict_type`, `css_class`, `list_class`, `is_default`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (21, 4, '授权', '4', 'sys_oper_type', '', 'primary', 'N', 103, 1, now(), NULL, now(), '授权操作');
INSERT INTO `sys_dict_data` (`dict_code`, `dict_sort`, `dict_label`, `dict_value`, `dict_type`, `css_class`, `list_class`, `is_default`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (22, 5, '导出', '5', 'sys_oper_type', '', 'warning', 'N', 103, 1, now(), NULL, now(), '导出操作');
INSERT INTO `sys_dict_data` (`dict_code`, `dict_sort`, `dict_label`, `dict_value`, `dict_type`, `css_class`, `list_class`, `is_default`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (23, 6, '导入', '6', 'sys_oper_type', '', 'warning', 'N', 103, 1, now(), NULL, now(), '导入操作');
INSERT INTO `sys_dict_data` (`dict_code`, `dict_sort`, `dict_label`, `dict_value`, `dict_type`, `css_class`, `list_class`, `is_default`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (24, 7, '强退', '7', 'sys_oper_type', '', 'danger', 'N', 103, 1, now(), NULL, now(), '强退操作');
INSERT INTO `sys_dict_data` (`dict_code`, `dict_sort`, `dict_label`, `dict_value`, `dict_type`, `css_class`, `list_class`, `is_default`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (25, 8, '生成代码', '8', 'sys_oper_type', '', 'warning', 'N', 103, 1, now(), NULL, now(), '生成操作');
INSERT INTO `sys_dict_data` (`dict_code`, `dict_sort`, `dict_label`, `dict_value`, `dict_type`, `css_class`, `list_class`, `is_default`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (26, 9, '清空数据', '9', 'sys_oper_type', '', 'danger', 'N', 103, 1, now(), NULL, now(), '清空操作');
INSERT INTO `sys_dict_data` (`dict_code`, `dict_sort`, `dict_label`, `dict_value`, `dict_type`, `css_class`, `list_class`, `is_default`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (27, 1, '成功', '0', 'sys_common_status', '', 'primary', 'N', 103, 1, now(), NULL, now(), '正常状态');
INSERT INTO `sys_dict_data` (`dict_code`, `dict_sort`, `dict_label`, `dict_value`, `dict_type`, `css_class`, `list_class`, `is_default`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (28, 2, '失败', '1', 'sys_common_status', '', 'danger', 'N', 103, 1, now(), NULL, now(), '停用状态');
INSERT INTO `sys_dict_data` (`dict_code`, `dict_sort`, `dict_label`, `dict_value`, `dict_type`, `css_class`, `list_class`, `is_default`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (29, 99, '其他', '0', 'sys_oper_type', '', 'info', 'N', 103, 1, now(), NULL, now(), '其他操作');
INSERT INTO `sys_dict_data` (`dict_code`, `dict_sort`, `dict_label`, `dict_value`, `dict_type`, `css_class`, `list_class`, `is_default`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (30, 0, '密码认证', 'password', 'sys_grant_type', 'el-check-tag', 'default', 'N', 103, 1, now(), NULL, now(), '密码认证');
INSERT INTO `sys_dict_data` (`dict_code`, `dict_sort`, `dict_label`, `dict_value`, `dict_type`, `css_class`, `list_class`, `is_default`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (32, 0, '邮件认证', 'email', 'sys_grant_type', 'el-check-tag', 'default', 'N', 103, 1, now(), NULL, now(), '邮件认证');
INSERT INTO `sys_dict_data` (`dict_code`, `dict_sort`, `dict_label`, `dict_value`, `dict_type`, `css_class`, `list_class`, `is_default`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (33, 0, '小程序认证', 'xcx', 'sys_grant_type', 'el-check-tag', 'default', 'N', 103, 1, now(), NULL, now(), '小程序认证');
INSERT INTO `sys_dict_data` (`dict_code`, `dict_sort`, `dict_label`, `dict_value`, `dict_type`, `css_class`, `list_class`, `is_default`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (35, 0, 'PC', 'pc', 'sys_device_type', '', 'default', 'N', 103, 1, now(), NULL, now(), 'PC');
INSERT INTO `sys_dict_data` (`dict_code`, `dict_sort`, `dict_label`, `dict_value`, `dict_type`, `css_class`, `list_class`, `is_default`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (36, 0, '安卓', 'android', 'sys_device_type', '', 'default', 'N', 103, 1, now(), NULL, now(), '安卓');
INSERT INTO `sys_dict_data` (`dict_code`, `dict_sort`, `dict_label`, `dict_value`, `dict_type`, `css_class`, `list_class`, `is_default`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (37, 0, 'iOS', 'ios', 'sys_device_type', '', 'default', 'N', 103, 1, now(), NULL, now(), 'iOS');
INSERT INTO `sys_dict_data` (`dict_code`, `dict_sort`, `dict_label`, `dict_value`, `dict_type`, `css_class`, `list_class`, `is_default`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (38, 0, '小程序', 'weapp', 'sys_device_type', '', 'default', 'N', 103, 1, now(), NULL, now(), '小程序');
INSERT INTO `sys_dict_data` (`dict_code`, `dict_sort`, `dict_label`, `dict_value`, `dict_type`, `css_class`, `list_class`, `is_default`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (53, 1, '未使用', '0', 'sys_invite_code_status', '', 'info', 'Y', 103, 1, now(), NULL, now(), '邀请码未使用');
INSERT INTO `sys_dict_data` (`dict_code`, `dict_sort`, `dict_label`, `dict_value`, `dict_type`, `css_class`, `list_class`, `is_default`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (54, 2, '已使用', '1', 'sys_invite_code_status', '', 'success', 'N', 103, 1, now(), NULL, now(), '邀请码已使用');
INSERT INTO `sys_dict_data` (`dict_code`, `dict_sort`, `dict_label`, `dict_value`, `dict_type`, `css_class`, `list_class`, `is_default`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (55, 3, '已作废', '2', 'sys_invite_code_status', '', 'warning', 'N', 103, 1, now(), NULL, now(), '邀请码已作废');
INSERT INTO `sys_dict_data` (`dict_code`, `dict_sort`, `dict_label`, `dict_value`, `dict_type`, `css_class`, `list_class`, `is_default`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (56, 4, '已过期', '3', 'sys_invite_code_status', '', 'danger', 'N', 103, 1, now(), NULL, now(), '邀请码已过期');
COMMIT;

-- ----------------------------
-- Table structure for sys_dict_type
-- ----------------------------
DROP TABLE IF EXISTS `sys_dict_type`;
CREATE TABLE `sys_dict_type` (
    `dict_id` bigint NOT NULL COMMENT '字典主键',
    `dict_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '' COMMENT '字典名称',
    `dict_type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '' COMMENT '字典类型',
    `create_dept` bigint DEFAULT NULL COMMENT '创建部门',
    `create_by` bigint DEFAULT NULL COMMENT '创建者',
    `create_time` datetime DEFAULT NULL COMMENT '创建时间',
    `update_by` bigint DEFAULT NULL COMMENT '更新者',
    `update_time` datetime DEFAULT NULL COMMENT '更新时间',
    `remark` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '备注',
    PRIMARY KEY (`dict_id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='字典类型表';

-- ----------------------------
-- Records of sys_dict_type
-- ----------------------------
BEGIN;
INSERT INTO `sys_dict_type` (`dict_id`, `dict_name`, `dict_type`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1, '用户性别', 'sys_user_sex', 103, 1, now(), NULL, now(), '用户性别列表');
INSERT INTO `sys_dict_type` (`dict_id`, `dict_name`, `dict_type`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (2, '菜单状态', 'sys_show_hide', 103, 1, now(), NULL, now(), '菜单状态列表');
INSERT INTO `sys_dict_type` (`dict_id`, `dict_name`, `dict_type`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (3, '系统开关', 'sys_normal_disable', 103, 1, now(), NULL, now(), '系统开关列表');
INSERT INTO `sys_dict_type` (`dict_id`, `dict_name`, `dict_type`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (6, '系统是否', 'sys_yes_no', 103, 1, now(), NULL, now(), '系统是否列表');
INSERT INTO `sys_dict_type` (`dict_id`, `dict_name`, `dict_type`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (7, '通知类型', 'sys_notice_type', 103, 1, now(), NULL, now(), '通知类型列表');
INSERT INTO `sys_dict_type` (`dict_id`, `dict_name`, `dict_type`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (8, '通知状态', 'sys_notice_status', 103, 1, now(), NULL, now(), '通知状态列表');
INSERT INTO `sys_dict_type` (`dict_id`, `dict_name`, `dict_type`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (9, '操作类型', 'sys_oper_type', 103, 1, now(), NULL, now(), '操作类型列表');
INSERT INTO `sys_dict_type` (`dict_id`, `dict_name`, `dict_type`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (10, '系统状态', 'sys_common_status', 103, 1, now(), NULL, now(), '登录状态列表');
INSERT INTO `sys_dict_type` (`dict_id`, `dict_name`, `dict_type`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (11, '授权类型', 'sys_grant_type', 103, 1, now(), NULL, now(), '认证授权类型');
INSERT INTO `sys_dict_type` (`dict_id`, `dict_name`, `dict_type`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (12, '设备类型', 'sys_device_type', 103, 1, now(), NULL, now(), '客户端设备类型');
INSERT INTO `sys_dict_type` (`dict_id`, `dict_name`, `dict_type`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (13, '邀请码状态', 'sys_invite_code_status', 103, 1, now(), NULL, now(), '邀请码总状态列表');
COMMIT;

-- ----------------------------
-- Table structure for sys_login_info
-- ----------------------------
DROP TABLE IF EXISTS `sys_login_info`;
CREATE TABLE `sys_login_info` (
    `info_id` bigint NOT NULL COMMENT '访问ID',
    `user_name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '' COMMENT '用户账号',
    `client_key` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '' COMMENT '客户端',
    `device_type` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '' COMMENT '设备类型',
    `ipaddr` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '' COMMENT '登录IP地址',
    `login_location` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '' COMMENT '登录地点',
    `browser` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '' COMMENT '浏览器类型',
    `os` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '' COMMENT '操作系统',
    `status` char(1) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '0' COMMENT '登录状态（0成功 1失败）',
    `msg` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '' COMMENT '提示消息',
    `login_time` datetime DEFAULT NULL COMMENT '访问时间',
    PRIMARY KEY (`info_id`) USING BTREE,
    KEY `idx_sys_login_info_s` (`status`) USING BTREE,
    KEY `idx_sys_login_info_lt` (`login_time`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='系统访问记录';

-- ----------------------------
-- Table structure for sys_menu
-- ----------------------------
DROP TABLE IF EXISTS `sys_menu`;
CREATE TABLE `sys_menu` (
    `menu_id` bigint NOT NULL COMMENT '菜单ID',
    `menu_name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '菜单名称',
    `parent_id` bigint DEFAULT '0' COMMENT '父菜单ID',
    `order_num` int DEFAULT '0' COMMENT '显示顺序',
    `path` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '' COMMENT '路由地址',
    `component` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '组件路径',
    `query_param` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '路由参数',
    `is_frame` int DEFAULT '1' COMMENT '是否为外链（0是 1否）',
    `is_cache` int DEFAULT '0' COMMENT '是否缓存（0缓存 1不缓存）',
    `menu_type` char(1) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '' COMMENT '菜单类型（M目录 C菜单 F按钮）',
    `visible` char(1) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '0' COMMENT '显示状态（0显示 1隐藏）',
    `status` char(1) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '0' COMMENT '菜单状态（0正常 1停用）',
    `perms` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '权限标识',
    `icon` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '#' COMMENT '菜单图标',
    `create_dept` bigint DEFAULT NULL COMMENT '创建部门',
    `create_by` bigint DEFAULT NULL COMMENT '创建者',
    `create_time` datetime DEFAULT NULL COMMENT '创建时间',
    `update_by` bigint DEFAULT NULL COMMENT '更新者',
    `update_time` datetime DEFAULT NULL COMMENT '更新时间',
    `remark` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '' COMMENT '备注',
    PRIMARY KEY (`menu_id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='菜单权限表';

-- ----------------------------
-- Records of sys_menu
-- ----------------------------
BEGIN;
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1, '系统管理', 0, 1, 'system', NULL, '', 1, 0, 'M', '0', '0', '', 'system', 103, 1, now(), NULL, now(), '系统管理目录');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (2, '系统监控', 0, 3, 'monitor', NULL, '', 1, 0, 'M', '0', '0', '', 'monitor', 103, 1, now(), NULL, now(), '系统监控目录');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (100, '用户管理', 1, 1, 'user', 'system/user/index', '', 1, 0, 'C', '0', '0', 'system:user:list', 'user', 103, 1, now(), NULL, now(), '用户管理菜单');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (101, '角色管理', 1, 2, 'role', 'system/role/index', '', 1, 0, 'C', '0', '0', 'system:role:list', 'peoples', 103, 1, now(), NULL, now(), '角色管理菜单');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (102, '菜单管理', 1, 3, 'menu', 'system/menu/index', '', 1, 0, 'C', '0', '0', 'system:menu:list', 'tree-table', 103, 1, now(), NULL, now(), '菜单管理菜单');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (103, '部门管理', 1, 4, 'dept', 'system/dept/index', '', 1, 0, 'C', '0', '0', 'system:dept:list', 'tree', 103, 1, now(), NULL, now(), '部门管理菜单');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (104, '岗位管理', 1, 5, 'post', 'system/post/index', '', 1, 0, 'C', '0', '0', 'system:post:list', 'post', 103, 1, now(), NULL, now(), '岗位管理菜单');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (105, '字典管理', 1, 6, 'dict', 'system/dict/index', '', 1, 0, 'C', '0', '0', 'system:dict:list', 'dict', 103, 1, now(), NULL, now(), '字典管理菜单');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (106, '参数设置', 1, 7, 'config', 'system/config/index', '', 1, 0, 'C', '0', '0', 'system:config:list', 'edit', 103, 1, now(), NULL, now(), '参数设置菜单');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (107, '通知公告', 1, 8, 'notice', 'system/notice/index', '', 1, 0, 'C', '0', '0', 'system:notice:list', 'message', 103, 1, now(), NULL, now(), '通知公告菜单');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (108, '日志管理', 1, 9, 'log', '', '', 1, 0, 'M', '0', '0', '', 'log', 103, 1, now(), NULL, now(), '日志管理菜单');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (109, '在线用户', 2, 1, 'online', 'monitor/online/index', '', 1, 0, 'C', '0', '0', 'monitor:online:list', 'online', 103, 1, now(), NULL, now(), '在线用户菜单');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (113, '缓存监控', 2, 5, 'cache', 'monitor/cache/index', '', 1, 0, 'C', '0', '0', 'monitor:cache:list', 'redis', 103, 1, now(), NULL, now(), '缓存监控菜单');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (118, '文件管理', 1, 10, 'oss', 'system/oss/index', '', 1, 0, 'C', '0', '0', 'system:oss:list', 'upload', 103, 1, now(), NULL, now(), '文件管理菜单');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (123, '客户端管理', 1, 11, 'client', 'system/client/index', '', 1, 0, 'C', '0', '0', 'system:client:list', 'international', 103, 1, now(), NULL, now(), '客户端管理菜单');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (124, '邀请码管理', 1, 12, 'invite', 'system/invite/index', '', 1, 0, 'C', '0', '0', 'system:invite:list', 'documentation', 103, 1, now(), NULL, now(), '邀请码管理菜单');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (130, '分配用户', 1, 2, 'role-auth/user/:roleId', 'system/role/authUser', '', 1, 1, 'C', '1', '0', 'system:role:edit', '#', 103, 1, now(), NULL, now(), '/system/role');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (131, '分配角色', 1, 1, 'user-auth/role/:userId', 'system/user/authRole', '', 1, 1, 'C', '1', '0', 'system:user:edit', '#', 103, 1, now(), NULL, now(), '/system/user');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (132, '字典数据', 1, 6, 'dict-data/index/:dictId', 'system/dict/data', '', 1, 1, 'C', '1', '0', 'system:dict:list', '#', 103, 1, now(), NULL, now(), '/system/dict');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (133, '文件配置管理', 1, 10, 'oss-config/index', 'system/oss/config', '', 1, 1, 'C', '1', '0', 'system:ossConfig:list', '#', 103, 1, now(), NULL, now(), '/system/oss');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (500, '操作日志', 108, 1, 'operLog', 'monitor/operLog/index', '', 1, 0, 'C', '0', '0', 'monitor:operLog:list', 'form', 103, 1, now(), NULL, now(), '操作日志菜单');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (501, '登录日志', 108, 2, 'loginInfo', 'monitor/loginInfo/index', '', 1, 0, 'C', '0', '0', 'monitor:loginInfo:list', 'loginInfo', 103, 1, now(), NULL, now(), '登录日志菜单');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1001, '用户查询', 100, 1, '', '', '', 1, 0, 'F', '0', '0', 'system:user:query', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1002, '用户新增', 100, 2, '', '', '', 1, 0, 'F', '0', '0', 'system:user:add', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1003, '用户修改', 100, 3, '', '', '', 1, 0, 'F', '0', '0', 'system:user:edit', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1004, '用户删除', 100, 4, '', '', '', 1, 0, 'F', '0', '0', 'system:user:remove', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1005, '用户导出', 100, 5, '', '', '', 1, 0, 'F', '0', '0', 'system:user:export', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1006, '用户导入', 100, 6, '', '', '', 1, 0, 'F', '0', '0', 'system:user:import', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1007, '重置密码', 100, 7, '', '', '', 1, 0, 'F', '0', '0', 'system:user:resetPwd', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1008, '角色查询', 101, 1, '', '', '', 1, 0, 'F', '0', '0', 'system:role:query', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1009, '角色新增', 101, 2, '', '', '', 1, 0, 'F', '0', '0', 'system:role:add', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1010, '角色修改', 101, 3, '', '', '', 1, 0, 'F', '0', '0', 'system:role:edit', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1011, '角色删除', 101, 4, '', '', '', 1, 0, 'F', '0', '0', 'system:role:remove', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1012, '角色导出', 101, 5, '', '', '', 1, 0, 'F', '0', '0', 'system:role:export', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1013, '菜单查询', 102, 1, '', '', '', 1, 0, 'F', '0', '0', 'system:menu:query', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1014, '菜单新增', 102, 2, '', '', '', 1, 0, 'F', '0', '0', 'system:menu:add', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1015, '菜单修改', 102, 3, '', '', '', 1, 0, 'F', '0', '0', 'system:menu:edit', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1016, '菜单删除', 102, 4, '', '', '', 1, 0, 'F', '0', '0', 'system:menu:remove', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1017, '部门查询', 103, 1, '', '', '', 1, 0, 'F', '0', '0', 'system:dept:query', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1018, '部门新增', 103, 2, '', '', '', 1, 0, 'F', '0', '0', 'system:dept:add', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1019, '部门修改', 103, 3, '', '', '', 1, 0, 'F', '0', '0', 'system:dept:edit', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1020, '部门删除', 103, 4, '', '', '', 1, 0, 'F', '0', '0', 'system:dept:remove', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1021, '岗位查询', 104, 1, '', '', '', 1, 0, 'F', '0', '0', 'system:post:query', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1022, '岗位新增', 104, 2, '', '', '', 1, 0, 'F', '0', '0', 'system:post:add', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1023, '岗位修改', 104, 3, '', '', '', 1, 0, 'F', '0', '0', 'system:post:edit', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1024, '岗位删除', 104, 4, '', '', '', 1, 0, 'F', '0', '0', 'system:post:remove', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1025, '岗位导出', 104, 5, '', '', '', 1, 0, 'F', '0', '0', 'system:post:export', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1026, '字典查询', 105, 1, '#', '', '', 1, 0, 'F', '0', '0', 'system:dict:query', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1027, '字典新增', 105, 2, '#', '', '', 1, 0, 'F', '0', '0', 'system:dict:add', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1028, '字典修改', 105, 3, '#', '', '', 1, 0, 'F', '0', '0', 'system:dict:edit', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1029, '字典删除', 105, 4, '#', '', '', 1, 0, 'F', '0', '0', 'system:dict:remove', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1030, '字典导出', 105, 5, '#', '', '', 1, 0, 'F', '0', '0', 'system:dict:export', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1031, '参数查询', 106, 1, '#', '', '', 1, 0, 'F', '0', '0', 'system:config:query', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1032, '参数新增', 106, 2, '#', '', '', 1, 0, 'F', '0', '0', 'system:config:add', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1033, '参数修改', 106, 3, '#', '', '', 1, 0, 'F', '0', '0', 'system:config:edit', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1034, '参数删除', 106, 4, '#', '', '', 1, 0, 'F', '0', '0', 'system:config:remove', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1035, '参数导出', 106, 5, '#', '', '', 1, 0, 'F', '0', '0', 'system:config:export', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1036, '公告查询', 107, 1, '#', '', '', 1, 0, 'F', '0', '0', 'system:notice:query', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1037, '公告新增', 107, 2, '#', '', '', 1, 0, 'F', '0', '0', 'system:notice:add', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1038, '公告修改', 107, 3, '#', '', '', 1, 0, 'F', '0', '0', 'system:notice:edit', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1039, '公告删除', 107, 4, '#', '', '', 1, 0, 'F', '0', '0', 'system:notice:remove', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1040, '操作查询', 500, 1, '#', '', '', 1, 0, 'F', '0', '0', 'monitor:operLog:query', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1041, '操作删除', 500, 2, '#', '', '', 1, 0, 'F', '0', '0', 'monitor:operLog:remove', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1042, '日志导出', 500, 4, '#', '', '', 1, 0, 'F', '0', '0', 'monitor:operLog:export', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1043, '登录查询', 501, 1, '#', '', '', 1, 0, 'F', '0', '0', 'monitor:loginInfo:query', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1044, '登录删除', 501, 2, '#', '', '', 1, 0, 'F', '0', '0', 'monitor:loginInfo:remove', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1045, '日志导出', 501, 3, '#', '', '', 1, 0, 'F', '0', '0', 'monitor:loginInfo:export', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1046, '在线查询', 109, 1, '#', '', '', 1, 0, 'F', '0', '0', 'monitor:online:query', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1047, '批量强退', 109, 2, '#', '', '', 1, 0, 'F', '0', '0', 'monitor:online:batchLogout', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1048, '单条强退', 109, 3, '#', '', '', 1, 0, 'F', '0', '0', 'monitor:online:forceLogout', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1050, '账户解锁', 501, 4, '#', '', '', 1, 0, 'F', '0', '0', 'monitor:loginInfo:unlock', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1061, '客户端管理查询', 123, 1, '#', '', '', 1, 0, 'F', '0', '0', 'system:client:query', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1062, '客户端管理新增', 123, 2, '#', '', '', 1, 0, 'F', '0', '0', 'system:client:add', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1063, '客户端管理修改', 123, 3, '#', '', '', 1, 0, 'F', '0', '0', 'system:client:edit', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1064, '客户端管理删除', 123, 4, '#', '', '', 1, 0, 'F', '0', '0', 'system:client:remove', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1065, '客户端管理导出', 123, 5, '#', '', '', 1, 0, 'F', '0', '0', 'system:client:export', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1066, '邀请码管理新增', 124, 1, '#', '', '', 1, 0, 'F', '0', '0', 'system:invite:add', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1067, '邀请码管理修改', 124, 2, '#', '', '', 1, 0, 'F', '0', '0', 'system:invite:edit', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1068, '邀请码管理删除', 124, 3, '#', '', '', 1, 0, 'F', '0', '0', 'system:invite:remove', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1069, '邀请码管理导出', 124, 4, '#', '', '', 1, 0, 'F', '0', '0', 'system:invite:export', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1600, '文件查询', 118, 1, '#', '', '', 1, 0, 'F', '0', '0', 'system:oss:query', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1601, '文件上传', 118, 2, '#', '', '', 1, 0, 'F', '0', '0', 'system:oss:upload', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1602, '文件下载', 118, 3, '#', '', '', 1, 0, 'F', '0', '0', 'system:oss:download', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1603, '文件删除', 118, 4, '#', '', '', 1, 0, 'F', '0', '0', 'system:oss:remove', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1620, '配置列表', 118, 5, '#', '', '', 1, 0, 'F', '0', '0', 'system:ossConfig:list', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1621, '配置添加', 118, 6, '#', '', '', 1, 0, 'F', '0', '0', 'system:ossConfig:add', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1622, '配置编辑', 118, 6, '#', '', '', 1, 0, 'F', '0', '0', 'system:ossConfig:edit', '#', 103, 1, now(), NULL, now(), '');
INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1623, '配置删除', 118, 6, '#', '', '', 1, 0, 'F', '0', '0', 'system:ossConfig:remove', '#', 103, 1, now(), NULL, now(), '');
COMMIT;

-- ----------------------------
-- Table structure for sys_notice
-- ----------------------------
DROP TABLE IF EXISTS `sys_notice`;
CREATE TABLE `sys_notice` (
    `notice_id` bigint NOT NULL COMMENT '公告ID',
    `notice_title` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '公告标题',
    `notice_type` char(1) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '公告类型（1通知 2公告）',
    `notice_content` longblob COMMENT '公告内容',
    `status` char(1) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '0' COMMENT '公告状态（0正常 1关闭）',
    `create_dept` bigint DEFAULT NULL COMMENT '创建部门',
    `create_by` bigint DEFAULT NULL COMMENT '创建者',
    `create_time` datetime DEFAULT NULL COMMENT '创建时间',
    `update_by` bigint DEFAULT NULL COMMENT '更新者',
    `update_time` datetime DEFAULT NULL COMMENT '更新时间',
    `remark` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '备注',
    PRIMARY KEY (`notice_id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='通知公告表';

-- ----------------------------
-- Records of sys_notice
-- ----------------------------
BEGIN;
INSERT INTO `sys_notice` (`notice_id`, `notice_title`, `notice_type`, `notice_content`, `status`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1, '温馨提醒：2026-01-01 新版本发布啦', '2', 0x3C703EE696B0E78988E69CACE58685E5AEB93C2F703E, '0', 103, 1, now(), 1, now(), '管理员');
INSERT INTO `sys_notice` (`notice_id`, `notice_title`, `notice_type`, `notice_content`, `status`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (2, '维护通知：2026-01-01 系统凌晨维护', '1', 0x3C703EE7BBB4E68AA4E58685E5AEB93C2F703E, '0', 103, 1, now(), 1, now(), '管理员');
COMMIT;

-- ----------------------------
-- Table structure for sys_oper_log
-- ----------------------------
DROP TABLE IF EXISTS `sys_oper_log`;
CREATE TABLE `sys_oper_log` (
    `oper_id` bigint NOT NULL COMMENT '日志主键',
    `title` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '' COMMENT '模块标题',
    `business_type` int DEFAULT '0' COMMENT '业务类型（0其它 1新增 2修改 3删除）',
    `method` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '' COMMENT '方法名称',
    `request_method` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '' COMMENT '请求方式',
    `operator_type` int DEFAULT '0' COMMENT '操作类别（0其它 1后台用户 2手机端用户）',
    `oper_name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '' COMMENT '操作人员',
    `dept_name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '' COMMENT '部门名称',
    `oper_url` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '' COMMENT '请求URL',
    `oper_ip` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '' COMMENT '主机地址',
    `oper_location` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '' COMMENT '操作地点',
    `oper_param` varchar(4000) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '' COMMENT '请求参数',
    `json_result` varchar(4000) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '' COMMENT '返回参数',
    `status` int DEFAULT '0' COMMENT '操作状态（0正常 1异常）',
    `error_msg` varchar(4000) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '' COMMENT '错误消息',
    `oper_time` datetime DEFAULT NULL COMMENT '操作时间',
    `cost_time` bigint DEFAULT '0' COMMENT '消耗时间',
    PRIMARY KEY (`oper_id`) USING BTREE,
    KEY `idx_sys_oper_log_bt` (`business_type`) USING BTREE,
    KEY `idx_sys_oper_log_s` (`status`) USING BTREE,
    KEY `idx_sys_oper_log_ot` (`oper_time`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='操作日志记录';

-- ----------------------------
-- Records of sys_oper_log
-- ----------------------------
BEGIN;
COMMIT;

-- ----------------------------
-- Table structure for sys_oss
-- ----------------------------
DROP TABLE IF EXISTS `sys_oss`;
CREATE TABLE `sys_oss` (
    `oss_id` bigint NOT NULL COMMENT '对象存储主键',
    `file_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT '' COMMENT '文件名',
    `original_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT '' COMMENT '原名',
    `file_suffix` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT '' COMMENT '文件后缀名',
    `url` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT 'URL地址',
    `ext1` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci COMMENT '扩展字段',
    `create_dept` bigint DEFAULT NULL COMMENT '创建部门',
    `create_time` datetime DEFAULT NULL COMMENT '创建时间',
    `create_by` bigint DEFAULT NULL COMMENT '上传人',
    `update_time` datetime DEFAULT NULL COMMENT '更新时间',
    `update_by` bigint DEFAULT NULL COMMENT '更新人',
    `service` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'minio' COMMENT '服务商',
    PRIMARY KEY (`oss_id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='OSS对象存储表';

-- ----------------------------
-- Records of sys_oss
-- ----------------------------
BEGIN;
COMMIT;

-- ----------------------------
-- Table structure for sys_oss_config
-- ----------------------------
DROP TABLE IF EXISTS `sys_oss_config`;
CREATE TABLE `sys_oss_config` (
    `oss_config_id` bigint NOT NULL COMMENT '主键',
    `config_key` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT '' COMMENT '配置key',
    `access_key` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '' COMMENT 'accessKey',
    `secret_key` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '' COMMENT '秘钥',
    `bucket_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '' COMMENT '桶名称',
    `prefix` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '' COMMENT '前缀',
    `endpoint` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '' COMMENT '访问站点',
    `domain` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '' COMMENT '自定义域名',
    `is_https` char(1) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT 'N' COMMENT '是否https（Y=是,N=否）',
    `region` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '' COMMENT '域',
    `access_policy` char(1) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT '1' COMMENT '桶权限类型(0=private 1=public 2=custom)',
    `status` char(1) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '1' COMMENT '是否默认（0=是,1=否）',
    `ext1` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '' COMMENT '扩展字段',
    `create_dept` bigint DEFAULT NULL COMMENT '创建部门',
    `create_by` bigint DEFAULT NULL COMMENT '创建者',
    `create_time` datetime DEFAULT NULL COMMENT '创建时间',
    `update_by` bigint DEFAULT NULL COMMENT '更新者',
    `update_time` datetime DEFAULT NULL COMMENT '更新时间',
    `remark` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '备注',
    PRIMARY KEY (`oss_config_id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='对象存储配置表';

-- ----------------------------
-- Records of sys_oss_config
-- ----------------------------
BEGIN;
INSERT INTO `sys_oss_config` (`oss_config_id`, `config_key`, `access_key`, `secret_key`, `bucket_name`, `prefix`, `endpoint`, `domain`, `is_https`, `region`, `access_policy`, `status`, `ext1`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1, 'minio', 'infoq', 'infoq123', 'infoq', '', '127.0.0.1:9000', '', 'N', '', '1', '0', '', 103, 1, now(), 1, now(), NULL);
INSERT INTO `sys_oss_config` (`oss_config_id`, `config_key`, `access_key`, `secret_key`, `bucket_name`, `prefix`, `endpoint`, `domain`, `is_https`, `region`, `access_policy`, `status`, `ext1`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (2, 'qiniu', 'XXXXXXXXXXXXXXX', 'XXXXXXXXXXXXXXX', 'infoq', '', 's3-cn-north-1.qiniucs.com', '', 'N', '', '1', '1', '', 103, 1, now(), 1, now(), NULL);
INSERT INTO `sys_oss_config` (`oss_config_id`, `config_key`, `access_key`, `secret_key`, `bucket_name`, `prefix`, `endpoint`, `domain`, `is_https`, `region`, `access_policy`, `status`, `ext1`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (3, 'aliyun', 'XXXXXXXXXXXXXXX', 'XXXXXXXXXXXXXXX', 'infoq', '', 'oss-cn-beijing.aliyuncs.com', '', 'N', '', '1', '1', '', 103, 1, now(), 1, now(), NULL);
INSERT INTO `sys_oss_config` (`oss_config_id`, `config_key`, `access_key`, `secret_key`, `bucket_name`, `prefix`, `endpoint`, `domain`, `is_https`, `region`, `access_policy`, `status`, `ext1`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (4, 'qcloud', 'XXXXXXXXXXXXXXX', 'XXXXXXXXXXXXXXX', 'infoq', '', 'cos.ap-beijing.myqcloud.com', '', 'N', 'ap-beijing', '1', '1', '', 103, 1, now(), 1, now(), NULL);
INSERT INTO `sys_oss_config` (`oss_config_id`, `config_key`, `access_key`, `secret_key`, `bucket_name`, `prefix`, `endpoint`, `domain`, `is_https`, `region`, `access_policy`, `status`, `ext1`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (5, 'image', 'infoq', 'infoq123', 'infoq', 'image', '127.0.0.1:9000', '', 'N', '', '1', '1', '', 103, 1, now(), 1, now(), NULL);
COMMIT;

-- ----------------------------
-- Table structure for sys_post
-- ----------------------------
DROP TABLE IF EXISTS `sys_post`;
CREATE TABLE `sys_post` (
    `post_id` bigint NOT NULL COMMENT '岗位ID',
    `dept_id` bigint NOT NULL COMMENT '部门id',
    `post_code` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '岗位编码',
    `post_category` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '岗位类别编码',
    `post_name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '岗位名称',
    `post_sort` int NOT NULL COMMENT '显示顺序',
    `status` char(1) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '状态（0正常 1停用）',
    `create_dept` bigint DEFAULT NULL COMMENT '创建部门',
    `create_by` bigint DEFAULT NULL COMMENT '创建者',
    `create_time` datetime DEFAULT NULL COMMENT '创建时间',
    `update_by` bigint DEFAULT NULL COMMENT '更新者',
    `update_time` datetime DEFAULT NULL COMMENT '更新时间',
    `remark` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '备注',
    PRIMARY KEY (`post_id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='岗位信息表';

-- ----------------------------
-- Records of sys_post
-- ----------------------------
BEGIN;
INSERT INTO `sys_post` (`post_id`, `dept_id`, `post_code`, `post_category`, `post_name`, `post_sort`, `status`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1, 110, 'ceo', NULL, '董事长', 1, '0', 103, 1, now(), 1, now(), '');
INSERT INTO `sys_post` (`post_id`, `dept_id`, `post_code`, `post_category`, `post_name`, `post_sort`, `status`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (2, 103, 'pm', NULL, '产品经理', 2, '0', 103, 1, now(), 1, now(), '');
INSERT INTO `sys_post` (`post_id`, `dept_id`, `post_code`, `post_category`, `post_name`, `post_sort`, `status`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (3, 111, 'hr', NULL, '人力资源', 3, '0', 103, 1, now(), 1, now(), '');
INSERT INTO `sys_post` (`post_id`, `dept_id`, `post_code`, `post_category`, `post_name`, `post_sort`, `status`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (4, 112, 'user', NULL, '普通员工', 4, '0', 103, 1, now(), 1, now(), '');
INSERT INTO `sys_post` (`post_id`, `dept_id`, `post_code`, `post_category`, `post_name`, `post_sort`, `status`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (5, 110, 'director', '', '董事', 2, '0', 103, 1, now(), 1, now(), '');
INSERT INTO `sys_post` (`post_id`, `dept_id`, `post_code`, `post_category`, `post_name`, `post_sort`, `status`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (6, 103, 'cto', '', '技术总监', 1, '0', 103, 1, now(), 1, now(), '');
COMMIT;

-- ----------------------------
-- Table structure for sys_role
-- ----------------------------
DROP TABLE IF EXISTS `sys_role`;
CREATE TABLE `sys_role` (
    `role_id` bigint NOT NULL COMMENT '角色ID',
    `role_name` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '角色名称',
    `role_key` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '角色权限字符串',
    `role_sort` int NOT NULL COMMENT '显示顺序',
    `data_scope` char(1) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '1' COMMENT '数据范围（1：全部数据权限 2：自定数据权限 3：本部门数据权限 4：本部门及以下数据权限 5：仅本人数据权限 6：部门及以下或本人数据权限）',
    `menu_check_strictly` tinyint(1) DEFAULT '1' COMMENT '菜单树选择项是否关联显示',
    `dept_check_strictly` tinyint(1) DEFAULT '1' COMMENT '部门树选择项是否关联显示',
    `status` char(1) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '角色状态（0正常 1停用）',
    `del_flag` char(1) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '0' COMMENT '删除标志（0代表存在 1代表删除）',
    `create_dept` bigint DEFAULT NULL COMMENT '创建部门',
    `create_by` bigint DEFAULT NULL COMMENT '创建者',
    `create_time` datetime DEFAULT NULL COMMENT '创建时间',
    `update_by` bigint DEFAULT NULL COMMENT '更新者',
    `update_time` datetime DEFAULT NULL COMMENT '更新时间',
    `remark` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '备注',
    PRIMARY KEY (`role_id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='角色信息表';

-- ----------------------------
-- Records of sys_role
-- ----------------------------
BEGIN;
INSERT INTO `sys_role` (`role_id`, `role_name`, `role_key`, `role_sort`, `data_scope`, `menu_check_strictly`, `dept_check_strictly`, `status`, `del_flag`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1, '超级管理员', 'superadmin', 1, '1', 1, 1, '0', '0', 103, 1, now(), NULL, now(), '超级管理员');
INSERT INTO `sys_role` (`role_id`, `role_name`, `role_key`, `role_sort`, `data_scope`, `menu_check_strictly`, `dept_check_strictly`, `status`, `del_flag`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (3, '本部门及以下', 'deptadmin', 2, '4', 1, 1, '0', '0', 103, 1, now(), 1, now(), '本部门及以下菜单数据权限');
INSERT INTO `sys_role` (`role_id`, `role_name`, `role_key`, `role_sort`, `data_scope`, `menu_check_strictly`, `dept_check_strictly`, `status`, `del_flag`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (4, '仅本人', 'owner', 3, '5', 1, 1, '0', '0', 103, 1, now(), 1, now(), '仅本人菜单数据权限');
COMMIT;

-- ----------------------------
-- Table structure for sys_role_dept
-- ----------------------------
DROP TABLE IF EXISTS `sys_role_dept`;
CREATE TABLE `sys_role_dept` (
    `role_id` bigint NOT NULL COMMENT '角色ID',
    `dept_id` bigint NOT NULL COMMENT '部门ID',
    PRIMARY KEY (`role_id`,`dept_id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='角色和部门关联表';

-- ----------------------------
-- Records of sys_role_dept
-- ----------------------------
BEGIN;
COMMIT;

-- ----------------------------
-- Table structure for sys_role_menu
-- ----------------------------
DROP TABLE IF EXISTS `sys_role_menu`;
CREATE TABLE `sys_role_menu` (
    `role_id` bigint NOT NULL COMMENT '角色ID',
    `menu_id` bigint NOT NULL COMMENT '菜单ID',
    PRIMARY KEY (`role_id`,`menu_id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='角色和菜单关联表';

-- ----------------------------
-- Records of sys_role_menu
-- ----------------------------
BEGIN;
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 1);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 100);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 101);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 102);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 103);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 104);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 105);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 106);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 107);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 108);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 118);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 123);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 130);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 131);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 132);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 133);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 500);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 501);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 1001);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 1002);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 1003);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 1004);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 1005);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 1006);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 1007);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 1008);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 1009);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 1010);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 1011);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 1012);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 1013);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 1014);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 1015);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 1016);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 1017);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 1018);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 1019);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 1020);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 1021);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 1022);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 1023);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 1024);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 1025);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 1026);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 1027);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 1028);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 1029);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 1030);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 1031);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 1032);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 1033);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 1034);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 1035);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 1036);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 1037);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 1038);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 1039);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 1040);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 1041);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 1042);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 1043);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 1044);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 1045);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 1050);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 1061);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 1062);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 1063);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 1064);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 1065);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 1600);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 1601);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 1602);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 1603);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 1620);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 1621);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 1622);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (3, 1623);
COMMIT;

-- ----------------------------
-- Table structure for sys_user
-- ----------------------------
DROP TABLE IF EXISTS `sys_user`;
CREATE TABLE `sys_user` (
    `user_id` bigint NOT NULL COMMENT '用户ID',
    `dept_id` bigint DEFAULT NULL COMMENT '部门ID',
    `user_name` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '用户账号',
    `nick_name` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '用户昵称',
    `user_type` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT 'sys_user' COMMENT '用户类型（sys_user系统用户）',
    `email` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '' COMMENT '用户邮箱',
    `phonenumber` varchar(11) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '' COMMENT '手机号码',
    `sex` char(1) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '0' COMMENT '用户性别（0男 1女 2未知）',
    `avatar` bigint DEFAULT NULL COMMENT '头像地址',
    `password` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '' COMMENT '密码',
    `status` char(1) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '0' COMMENT '帐号状态（0正常 1停用）',
    `del_flag` char(1) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '0' COMMENT '删除标志（0代表存在 1代表删除）',
    `login_ip` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '' COMMENT '最后登录IP',
    `login_date` datetime DEFAULT NULL COMMENT '最后登录时间',
    `create_dept` bigint DEFAULT NULL COMMENT '创建部门',
    `create_by` bigint DEFAULT NULL COMMENT '创建者',
    `create_time` datetime DEFAULT NULL COMMENT '创建时间',
    `update_by` bigint DEFAULT NULL COMMENT '更新者',
    `update_time` datetime DEFAULT NULL COMMENT '更新时间',
    `remark` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '备注',
    PRIMARY KEY (`user_id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户信息表';

-- ----------------------------
-- Records of sys_user
-- ----------------------------
BEGIN;
INSERT INTO `sys_user` (`user_id`, `dept_id`, `user_name`, `nick_name`, `user_type`, `email`, `phonenumber`, `sex`, `avatar`, `password`, `status`, `del_flag`, `login_ip`, `login_date`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1, 103, 'admin', 'Pontus', 'sys_user', 'luckykuang@foxmail.com', '15888888888', '1', NULL, '$2a$10$7JB720yubVSZvUI0rEqK/.VqGOZTH.ulu33dHOiBE8ByOhJIrdAu2', '0', '0', '0:0:0:0:0:0:0:1', '2026-01-01 00:00:00', 103, 1, now(), -1, now(), '管理员');
INSERT INTO `sys_user` (`user_id`, `dept_id`, `user_name`, `nick_name`, `user_type`, `email`, `phonenumber`, `sex`, `avatar`, `password`, `status`, `del_flag`, `login_ip`, `login_date`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (3, 108, 'dept', '本部门及以下 密码666666', 'sys_user', '', '', '0', NULL, '$2a$10$b8yUzN0C71sbz.PhNOCgJe.Tu1yWC3RNrTyjSQ8p1W0.aaUXUJ.Ne', '0', '0', '127.0.0.1', '2026-01-01 00:00:00', 103, 1, now(), 3, now(), NULL);
INSERT INTO `sys_user` (`user_id`, `dept_id`, `user_name`, `nick_name`, `user_type`, `email`, `phonenumber`, `sex`, `avatar`, `password`, `status`, `del_flag`, `login_ip`, `login_date`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (4, 102, 'owner', '仅本人 密码666666', 'sys_user', '', '', '0', NULL, '$2a$10$b8yUzN0C71sbz.PhNOCgJe.Tu1yWC3RNrTyjSQ8p1W0.aaUXUJ.Ne', '0', '0', '127.0.0.1', '2026-01-01 00:00:00', 103, 1, now(), 4, now(), NULL);
COMMIT;

-- ----------------------------
-- Table structure for sys_user_post
-- ----------------------------
DROP TABLE IF EXISTS `sys_user_post`;
CREATE TABLE `sys_user_post` (
    `user_id` bigint NOT NULL COMMENT '用户ID',
    `post_id` bigint NOT NULL COMMENT '岗位ID',
    PRIMARY KEY (`user_id`,`post_id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户与岗位关联表';

-- ----------------------------
-- Records of sys_user_post
-- ----------------------------
BEGIN;
INSERT INTO `sys_user_post` (`user_id`, `post_id`) VALUES (1, 1);
COMMIT;

-- ----------------------------
-- Table structure for sys_user_role
-- ----------------------------
DROP TABLE IF EXISTS `sys_user_role`;
CREATE TABLE `sys_user_role` (
    `user_id` bigint NOT NULL COMMENT '用户ID',
    `role_id` bigint NOT NULL COMMENT '角色ID',
    PRIMARY KEY (`user_id`,`role_id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户和角色关联表';

-- ----------------------------
-- Records of sys_user_role
-- ----------------------------
BEGIN;
INSERT INTO `sys_user_role` (`user_id`, `role_id`) VALUES (1, 1);
INSERT INTO `sys_user_role` (`user_id`, `role_id`) VALUES (3, 3);
INSERT INTO `sys_user_role` (`user_id`, `role_id`) VALUES (4, 4);
COMMIT;

SET FOREIGN_KEY_CHECKS = 1;

-- ========================================
-- 第二部分: 定时任务模块
-- 来源: infoq_scaffold_update_20260425.sql
-- 日期: 2026-04-25
-- 说明: 添加 Quartz 定时任务支持
-- ========================================


CREATE TABLE IF NOT EXISTS `sys_job` (
    `job_id` bigint NOT NULL COMMENT '任务ID',
    `job_name` varchar(128) NOT NULL COMMENT '任务名称',
    `job_group` varchar(64) NOT NULL COMMENT '任务分组',
    `handler_key` varchar(128) NOT NULL COMMENT '处理器标识',
    `handler_params` text COMMENT '处理器参数(JSON对象)',
    `cron_expression` varchar(255) NOT NULL COMMENT 'Cron表达式',
    `misfire_policy` char(1) NOT NULL DEFAULT '0' COMMENT '错过策略（0默认 1立即补跑 2触发后继续 3忽略本次）',
    `concurrent` char(1) NOT NULL DEFAULT '1' COMMENT '并发策略（0允许 1禁止）',
    `status` char(1) NOT NULL DEFAULT '1' COMMENT '状态（0正常 1暂停）',
    `del_flag` char(1) NOT NULL DEFAULT '0' COMMENT '删除标记（0存在 1删除）',
    `create_dept` bigint DEFAULT NULL COMMENT '创建部门',
    `create_by` bigint DEFAULT NULL COMMENT '创建者',
    `create_time` datetime DEFAULT NULL COMMENT '创建时间',
    `update_by` bigint DEFAULT NULL COMMENT '更新者',
    `update_time` datetime DEFAULT NULL COMMENT '更新时间',
    `remark` varchar(500) DEFAULT NULL COMMENT '备注',
    PRIMARY KEY (`job_id`) USING BTREE,
    KEY `idx_sys_job_group_status` (`job_group`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='定时任务表';

CREATE TABLE IF NOT EXISTS `sys_job_log` (
    `job_log_id` bigint NOT NULL COMMENT '任务日志ID',
    `job_id` bigint NOT NULL COMMENT '任务ID',
    `job_name` varchar(128) NOT NULL COMMENT '任务名称',
    `job_group` varchar(64) NOT NULL COMMENT '任务分组',
    `handler_key` varchar(128) NOT NULL COMMENT '处理器标识',
    `handler_params` text COMMENT '处理器参数(JSON对象)',
    `trigger_source` varchar(32) NOT NULL COMMENT '触发来源',
    `job_message` varchar(1000) DEFAULT NULL COMMENT '执行消息',
    `status` char(1) NOT NULL DEFAULT '0' COMMENT '执行状态（0成功 1失败）',
    `exception_info` text COMMENT '异常信息',
    `duration_ms` bigint DEFAULT NULL COMMENT '耗时毫秒',
    `start_time` datetime DEFAULT NULL COMMENT '开始时间',
    `end_time` datetime DEFAULT NULL COMMENT '结束时间',
    PRIMARY KEY (`job_log_id`) USING BTREE,
    KEY `idx_sys_job_log_job_id` (`job_id`),
    KEY `idx_sys_job_log_status_start` (`status`, `start_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='定时任务日志表';

CREATE TABLE IF NOT EXISTS `QRTZ_JOB_DETAILS` (
    `SCHED_NAME` varchar(120) NOT NULL COMMENT '调度器名称',
    `JOB_NAME` varchar(200) NOT NULL COMMENT '任务名称',
    `JOB_GROUP` varchar(200) NOT NULL COMMENT '任务分组',
    `DESCRIPTION` varchar(250) DEFAULT NULL COMMENT '任务描述',
    `JOB_CLASS_NAME` varchar(250) NOT NULL COMMENT 'Quartz任务执行类全名',
    `IS_DURABLE` varchar(1) NOT NULL COMMENT '是否持久化（0否 1是）',
    `IS_NONCONCURRENT` varchar(1) NOT NULL COMMENT '是否禁止并发执行（0否 1是）',
    `IS_UPDATE_DATA` varchar(1) NOT NULL COMMENT '执行后是否更新JobData',
    `REQUESTS_RECOVERY` varchar(1) NOT NULL COMMENT '调度恢复后是否重新执行',
    `JOB_DATA` blob COMMENT '任务数据',
    PRIMARY KEY (`SCHED_NAME`,`JOB_NAME`,`JOB_GROUP`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Quartz任务明细表';

CREATE TABLE IF NOT EXISTS `QRTZ_TRIGGERS` (
    `SCHED_NAME` varchar(120) NOT NULL COMMENT '调度器名称',
    `TRIGGER_NAME` varchar(200) NOT NULL COMMENT '触发器名称',
    `TRIGGER_GROUP` varchar(200) NOT NULL COMMENT '触发器分组',
    `JOB_NAME` varchar(200) NOT NULL COMMENT '关联任务名称',
    `JOB_GROUP` varchar(200) NOT NULL COMMENT '关联任务分组',
    `DESCRIPTION` varchar(250) DEFAULT NULL COMMENT '触发器描述',
    `NEXT_FIRE_TIME` bigint DEFAULT NULL COMMENT '下一次触发时间戳',
    `PREV_FIRE_TIME` bigint DEFAULT NULL COMMENT '上一次触发时间戳',
    `PRIORITY` int DEFAULT NULL COMMENT '触发优先级',
    `TRIGGER_STATE` varchar(16) NOT NULL COMMENT '触发器状态',
    `TRIGGER_TYPE` varchar(8) NOT NULL COMMENT '触发器类型',
    `START_TIME` bigint NOT NULL COMMENT '开始生效时间戳',
    `END_TIME` bigint DEFAULT NULL COMMENT '结束时间戳',
    `CALENDAR_NAME` varchar(200) DEFAULT NULL COMMENT '日历名称',
    `MISFIRE_INSTR` smallint DEFAULT NULL COMMENT 'misfire处理指令',
    `JOB_DATA` blob COMMENT '触发器数据',
    PRIMARY KEY (`SCHED_NAME`,`TRIGGER_NAME`,`TRIGGER_GROUP`),
    KEY `idx_qrtz_t_j` (`SCHED_NAME`,`JOB_NAME`,`JOB_GROUP`),
    CONSTRAINT `QRTZ_TRIGGERS_ibfk_1` FOREIGN KEY (`SCHED_NAME`, `JOB_NAME`, `JOB_GROUP`)
        REFERENCES `QRTZ_JOB_DETAILS` (`SCHED_NAME`, `JOB_NAME`, `JOB_GROUP`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Quartz触发器表';

CREATE TABLE IF NOT EXISTS `QRTZ_SIMPLE_TRIGGERS` (
    `SCHED_NAME` varchar(120) NOT NULL COMMENT '调度器名称',
    `TRIGGER_NAME` varchar(200) NOT NULL COMMENT '触发器名称',
    `TRIGGER_GROUP` varchar(200) NOT NULL COMMENT '触发器分组',
    `REPEAT_COUNT` bigint NOT NULL COMMENT '重复次数',
    `REPEAT_INTERVAL` bigint NOT NULL COMMENT '重复间隔毫秒',
    `TIMES_TRIGGERED` bigint NOT NULL COMMENT '已触发次数',
    PRIMARY KEY (`SCHED_NAME`,`TRIGGER_NAME`,`TRIGGER_GROUP`),
    CONSTRAINT `QRTZ_SIMPLE_TRIG_IBFK_1` FOREIGN KEY (`SCHED_NAME`, `TRIGGER_NAME`, `TRIGGER_GROUP`)
        REFERENCES `QRTZ_TRIGGERS` (`SCHED_NAME`, `TRIGGER_NAME`, `TRIGGER_GROUP`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Quartz简单触发器表';

CREATE TABLE IF NOT EXISTS `QRTZ_CRON_TRIGGERS` (
    `SCHED_NAME` varchar(120) NOT NULL COMMENT '调度器名称',
    `TRIGGER_NAME` varchar(200) NOT NULL COMMENT '触发器名称',
    `TRIGGER_GROUP` varchar(200) NOT NULL COMMENT '触发器分组',
    `CRON_EXPRESSION` varchar(200) NOT NULL COMMENT 'Cron表达式',
    `TIME_ZONE_ID` varchar(80) DEFAULT NULL COMMENT '时区ID',
    PRIMARY KEY (`SCHED_NAME`,`TRIGGER_NAME`,`TRIGGER_GROUP`),
    CONSTRAINT `QRTZ_CRON_TRIG_IBFK_1` FOREIGN KEY (`SCHED_NAME`, `TRIGGER_NAME`, `TRIGGER_GROUP`)
        REFERENCES `QRTZ_TRIGGERS` (`SCHED_NAME`, `TRIGGER_NAME`, `TRIGGER_GROUP`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Quartz Cron触发器表';

CREATE TABLE IF NOT EXISTS `QRTZ_SIMPROP_TRIGGERS` (
    `SCHED_NAME` varchar(120) NOT NULL COMMENT '调度器名称',
    `TRIGGER_NAME` varchar(200) NOT NULL COMMENT '触发器名称',
    `TRIGGER_GROUP` varchar(200) NOT NULL COMMENT '触发器分组',
    `STR_PROP_1` varchar(512) DEFAULT NULL COMMENT '字符串属性1',
    `STR_PROP_2` varchar(512) DEFAULT NULL COMMENT '字符串属性2',
    `STR_PROP_3` varchar(512) DEFAULT NULL COMMENT '字符串属性3',
    `INT_PROP_1` int DEFAULT NULL COMMENT '整型属性1',
    `INT_PROP_2` int DEFAULT NULL COMMENT '整型属性2',
    `LONG_PROP_1` bigint DEFAULT NULL COMMENT '长整型属性1',
    `LONG_PROP_2` bigint DEFAULT NULL COMMENT '长整型属性2',
    `DEC_PROP_1` numeric(13,4) DEFAULT NULL COMMENT '小数属性1',
    `DEC_PROP_2` numeric(13,4) DEFAULT NULL COMMENT '小数属性2',
    `BOOL_PROP_1` varchar(1) DEFAULT NULL COMMENT '布尔属性1',
    `BOOL_PROP_2` varchar(1) DEFAULT NULL COMMENT '布尔属性2',
    PRIMARY KEY (`SCHED_NAME`,`TRIGGER_NAME`,`TRIGGER_GROUP`),
    CONSTRAINT `QRTZ_SIMPROP_TRIG_IBFK_1` FOREIGN KEY (`SCHED_NAME`, `TRIGGER_NAME`, `TRIGGER_GROUP`)
        REFERENCES `QRTZ_TRIGGERS` (`SCHED_NAME`, `TRIGGER_NAME`, `TRIGGER_GROUP`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Quartz扩展属性触发器表';

CREATE TABLE IF NOT EXISTS `QRTZ_BLOB_TRIGGERS` (
    `SCHED_NAME` varchar(120) NOT NULL COMMENT '调度器名称',
    `TRIGGER_NAME` varchar(200) NOT NULL COMMENT '触发器名称',
    `TRIGGER_GROUP` varchar(200) NOT NULL COMMENT '触发器分组',
    `BLOB_DATA` blob COMMENT '二进制触发器数据',
    PRIMARY KEY (`SCHED_NAME`,`TRIGGER_NAME`,`TRIGGER_GROUP`),
    CONSTRAINT `QRTZ_BLOB_TRIG_IBFK_1` FOREIGN KEY (`SCHED_NAME`, `TRIGGER_NAME`, `TRIGGER_GROUP`)
        REFERENCES `QRTZ_TRIGGERS` (`SCHED_NAME`, `TRIGGER_NAME`, `TRIGGER_GROUP`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Quartz二进制触发器表';

CREATE TABLE IF NOT EXISTS `QRTZ_CALENDARS` (
    `SCHED_NAME` varchar(120) NOT NULL COMMENT '调度器名称',
    `CALENDAR_NAME` varchar(200) NOT NULL COMMENT '日历名称',
    `CALENDAR` blob NOT NULL COMMENT '日历序列化数据',
    PRIMARY KEY (`SCHED_NAME`,`CALENDAR_NAME`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Quartz日历表';

CREATE TABLE IF NOT EXISTS `QRTZ_PAUSED_TRIGGER_GRPS` (
    `SCHED_NAME` varchar(120) NOT NULL COMMENT '调度器名称',
    `TRIGGER_GROUP` varchar(200) NOT NULL COMMENT '已暂停的触发器分组',
    PRIMARY KEY (`SCHED_NAME`,`TRIGGER_GROUP`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Quartz暂停触发器分组表';

CREATE TABLE IF NOT EXISTS `QRTZ_FIRED_TRIGGERS` (
    `SCHED_NAME` varchar(120) NOT NULL COMMENT '调度器名称',
    `ENTRY_ID` varchar(95) NOT NULL COMMENT '已触发记录ID',
    `TRIGGER_NAME` varchar(200) NOT NULL COMMENT '触发器名称',
    `TRIGGER_GROUP` varchar(200) NOT NULL COMMENT '触发器分组',
    `INSTANCE_NAME` varchar(200) NOT NULL COMMENT '调度实例名称',
    `FIRED_TIME` bigint NOT NULL COMMENT '实际触发时间戳',
    `SCHED_TIME` bigint NOT NULL COMMENT '计划触发时间戳',
    `PRIORITY` int NOT NULL COMMENT '优先级',
    `STATE` varchar(16) NOT NULL COMMENT '触发状态',
    `JOB_NAME` varchar(200) DEFAULT NULL COMMENT '任务名称',
    `JOB_GROUP` varchar(200) DEFAULT NULL COMMENT '任务分组',
    `IS_NONCONCURRENT` varchar(1) DEFAULT NULL COMMENT '是否禁止并发执行',
    `REQUESTS_RECOVERY` varchar(1) DEFAULT NULL COMMENT '是否请求恢复执行',
    PRIMARY KEY (`SCHED_NAME`,`ENTRY_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Quartz已触发触发器表';

CREATE TABLE IF NOT EXISTS `QRTZ_SCHEDULER_STATE` (
    `SCHED_NAME` varchar(120) NOT NULL COMMENT '调度器名称',
    `INSTANCE_NAME` varchar(200) NOT NULL COMMENT '调度实例名称',
    `LAST_CHECKIN_TIME` bigint NOT NULL COMMENT '最后一次心跳检查时间戳',
    `CHECKIN_INTERVAL` bigint NOT NULL COMMENT '心跳检查间隔毫秒',
    PRIMARY KEY (`SCHED_NAME`,`INSTANCE_NAME`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Quartz调度器状态表';

CREATE TABLE IF NOT EXISTS `QRTZ_LOCKS` (
    `SCHED_NAME` varchar(120) NOT NULL COMMENT '调度器名称',
    `LOCK_NAME` varchar(40) NOT NULL COMMENT '锁名称',
    PRIMARY KEY (`SCHED_NAME`,`LOCK_NAME`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Quartz锁表';

INSERT INTO `sys_dict_type` (`dict_id`, `dict_name`, `dict_type`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`)
SELECT 2026042501, '任务状态', 'sys_job_status', 103, 1, NOW(), 1, NOW(), '定时任务状态'
WHERE NOT EXISTS (SELECT 1 FROM `sys_dict_type` WHERE `dict_type` = 'sys_job_status');

INSERT INTO `sys_dict_type` (`dict_id`, `dict_name`, `dict_type`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`)
SELECT 2026042502, '任务分组', 'sys_job_group', 103, 1, NOW(), 1, NOW(), '定时任务分组'
WHERE NOT EXISTS (SELECT 1 FROM `sys_dict_type` WHERE `dict_type` = 'sys_job_group');

INSERT INTO `sys_dict_type` (`dict_id`, `dict_name`, `dict_type`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`)
SELECT 2026042503, '错过策略', 'sys_job_misfire_policy', 103, 1, NOW(), 1, NOW(), 'Quartz 错过策略'
WHERE NOT EXISTS (SELECT 1 FROM `sys_dict_type` WHERE `dict_type` = 'sys_job_misfire_policy');

INSERT INTO `sys_dict_type` (`dict_id`, `dict_name`, `dict_type`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`)
SELECT 2026042504, '并发策略', 'sys_job_concurrent', 103, 1, NOW(), 1, NOW(), 'Quartz 并发策略'
WHERE NOT EXISTS (SELECT 1 FROM `sys_dict_type` WHERE `dict_type` = 'sys_job_concurrent');

INSERT INTO `sys_dict_data` (`dict_code`, `dict_sort`, `dict_label`, `dict_value`, `dict_type`, `css_class`, `list_class`, `is_default`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`)
SELECT 202604250101, 1, '正常', '0', 'sys_job_status', '', 'primary', 'Y', 103, 1, NOW(), 1, NOW(), '任务启用'
WHERE NOT EXISTS (SELECT 1 FROM `sys_dict_data` WHERE `dict_type` = 'sys_job_status' AND `dict_value` = '0');

INSERT INTO `sys_dict_data` (`dict_code`, `dict_sort`, `dict_label`, `dict_value`, `dict_type`, `css_class`, `list_class`, `is_default`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`)
SELECT 202604250102, 2, '暂停', '1', 'sys_job_status', '', 'danger', 'N', 103, 1, NOW(), 1, NOW(), '任务暂停'
WHERE NOT EXISTS (SELECT 1 FROM `sys_dict_data` WHERE `dict_type` = 'sys_job_status' AND `dict_value` = '1');

INSERT INTO `sys_dict_data` (`dict_code`, `dict_sort`, `dict_label`, `dict_value`, `dict_type`, `css_class`, `list_class`, `is_default`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`)
SELECT 202604250201, 1, '系统任务', 'SYSTEM', 'sys_job_group', '', 'primary', 'Y', 103, 1, NOW(), 1, NOW(), '系统托管任务'
WHERE NOT EXISTS (SELECT 1 FROM `sys_dict_data` WHERE `dict_type` = 'sys_job_group' AND `dict_value` = 'SYSTEM');

INSERT INTO `sys_dict_data` (`dict_code`, `dict_sort`, `dict_label`, `dict_value`, `dict_type`, `css_class`, `list_class`, `is_default`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`)
SELECT 202604250301, 1, '默认策略', '0', 'sys_job_misfire_policy', '', 'default', 'Y', 103, 1, NOW(), 1, NOW(), '默认处理'
WHERE NOT EXISTS (SELECT 1 FROM `sys_dict_data` WHERE `dict_type` = 'sys_job_misfire_policy' AND `dict_value` = '0');

INSERT INTO `sys_dict_data` (`dict_code`, `dict_sort`, `dict_label`, `dict_value`, `dict_type`, `css_class`, `list_class`, `is_default`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`)
SELECT 202604250302, 2, '忽略错过', '1', 'sys_job_misfire_policy', '', 'warning', 'N', 103, 1, NOW(), 1, NOW(), '忽略所有错过'
WHERE NOT EXISTS (SELECT 1 FROM `sys_dict_data` WHERE `dict_type` = 'sys_job_misfire_policy' AND `dict_value` = '1');

INSERT INTO `sys_dict_data` (`dict_code`, `dict_sort`, `dict_label`, `dict_value`, `dict_type`, `css_class`, `list_class`, `is_default`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`)
SELECT 202604250303, 3, '立即补跑', '2', 'sys_job_misfire_policy', '', 'success', 'N', 103, 1, NOW(), 1, NOW(), '立刻执行一次再继续'
WHERE NOT EXISTS (SELECT 1 FROM `sys_dict_data` WHERE `dict_type` = 'sys_job_misfire_policy' AND `dict_value` = '2');

INSERT INTO `sys_dict_data` (`dict_code`, `dict_sort`, `dict_label`, `dict_value`, `dict_type`, `css_class`, `list_class`, `is_default`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`)
SELECT 202604250304, 4, '跳过本次', '3', 'sys_job_misfire_policy', '', 'info', 'N', 103, 1, NOW(), 1, NOW(), '跳过错过的触发'
WHERE NOT EXISTS (SELECT 1 FROM `sys_dict_data` WHERE `dict_type` = 'sys_job_misfire_policy' AND `dict_value` = '3');

INSERT INTO `sys_dict_data` (`dict_code`, `dict_sort`, `dict_label`, `dict_value`, `dict_type`, `css_class`, `list_class`, `is_default`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`)
SELECT 202604250401, 1, '允许并发', '0', 'sys_job_concurrent', '', 'success', 'Y', 103, 1, NOW(), 1, NOW(), '允许并发执行'
WHERE NOT EXISTS (SELECT 1 FROM `sys_dict_data` WHERE `dict_type` = 'sys_job_concurrent' AND `dict_value` = '0');

INSERT INTO `sys_dict_data` (`dict_code`, `dict_sort`, `dict_label`, `dict_value`, `dict_type`, `css_class`, `list_class`, `is_default`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`)
SELECT 202604250402, 2, '禁止并发', '1', 'sys_job_concurrent', '', 'danger', 'N', 103, 1, NOW(), 1, NOW(), '串行执行'
WHERE NOT EXISTS (SELECT 1 FROM `sys_dict_data` WHERE `dict_type` = 'sys_job_concurrent' AND `dict_value` = '1');

INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`)
SELECT 2026042510, '定时任务', 2, 2, 'job', 'monitor/job/index', '', 1, 0, 'C', '0', '0', 'monitor:job:list', 'job', 103, 1, NOW(), 1, NOW(), '定时任务菜单'
WHERE NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `menu_id` = 2026042510);

INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`)
SELECT 2026042520, '任务日志', 2, 3, 'jobLog', 'monitor/jobLog/index', '', 1, 0, 'C', '0', '0', 'monitor:jobLog:list', 'form', 103, 1, NOW(), 1, NOW(), '定时任务日志菜单'
WHERE NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `menu_id` = 2026042520);

INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`)
SELECT 2026042511, '任务查询', 2026042510, 1, '#', '', '', 1, 0, 'F', '0', '0', 'monitor:job:query', '#', 103, 1, NOW(), 1, NOW(), ''
WHERE NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `menu_id` = 2026042511);

INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`)
SELECT 2026042512, '任务新增', 2026042510, 2, '#', '', '', 1, 0, 'F', '0', '0', 'monitor:job:add', '#', 103, 1, NOW(), 1, NOW(), ''
WHERE NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `menu_id` = 2026042512);

INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`)
SELECT 2026042513, '任务修改', 2026042510, 3, '#', '', '', 1, 0, 'F', '0', '0', 'monitor:job:edit', '#', 103, 1, NOW(), 1, NOW(), ''
WHERE NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `menu_id` = 2026042513);

INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`)
SELECT 2026042514, '任务删除', 2026042510, 4, '#', '', '', 1, 0, 'F', '0', '0', 'monitor:job:remove', '#', 103, 1, NOW(), 1, NOW(), ''
WHERE NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `menu_id` = 2026042514);

INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`)
SELECT 2026042515, '任务导出', 2026042510, 5, '#', '', '', 1, 0, 'F', '0', '0', 'monitor:job:export', '#', 103, 1, NOW(), 1, NOW(), ''
WHERE NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `menu_id` = 2026042515);

INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`)
SELECT 2026042516, '状态切换', 2026042510, 6, '#', '', '', 1, 0, 'F', '0', '0', 'monitor:job:changeStatus', '#', 103, 1, NOW(), 1, NOW(), ''
WHERE NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `menu_id` = 2026042516);

INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`)
SELECT 2026042517, '立即执行', 2026042510, 7, '#', '', '', 1, 0, 'F', '0', '0', 'monitor:job:run', '#', 103, 1, NOW(), 1, NOW(), ''
WHERE NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `menu_id` = 2026042517);

INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`)
SELECT 2026042521, '日志查询', 2026042520, 1, '#', '', '', 1, 0, 'F', '0', '0', 'monitor:jobLog:query', '#', 103, 1, NOW(), 1, NOW(), ''
WHERE NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `menu_id` = 2026042521);

INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`)
SELECT 2026042522, '日志删除', 2026042520, 2, '#', '', '', 1, 0, 'F', '0', '0', 'monitor:jobLog:remove', '#', 103, 1, NOW(), 1, NOW(), ''
WHERE NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `menu_id` = 2026042522);

INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`)
SELECT 2026042523, '日志导出', 2026042520, 3, '#', '', '', 1, 0, 'F', '0', '0', 'monitor:jobLog:export', '#', 103, 1, NOW(), 1, NOW(), ''
WHERE NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `menu_id` = 2026042523);

INSERT INTO `sys_menu` (`menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`, `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`)
SELECT 2026042524, '日志清空', 2026042520, 4, '#', '', '', 1, 0, 'F', '0', '0', 'monitor:jobLog:remove', '#', 103, 1, NOW(), 1, NOW(), ''
WHERE NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `menu_id` = 2026042524);

INSERT INTO `sys_role_menu` (`role_id`, `menu_id`)
SELECT 1, menu_id FROM `sys_menu`
WHERE menu_id IN (
    2026042510, 2026042520, 2026042511, 2026042512, 2026042513, 2026042514,
    2026042515, 2026042516, 2026042517, 2026042521, 2026042522, 2026042523, 2026042524
) AND NOT EXISTS (
    SELECT 1 FROM `sys_role_menu` rm WHERE rm.role_id = 1 AND rm.menu_id = `sys_menu`.menu_id
);

INSERT INTO `sys_role_menu` (`role_id`, `menu_id`)
SELECT 3, menu_id FROM `sys_menu`
WHERE menu_id IN (
    2026042510, 2026042520, 2026042511, 2026042521
) AND NOT EXISTS (
    SELECT 1 FROM `sys_role_menu` rm WHERE rm.role_id = 3 AND rm.menu_id = `sys_menu`.menu_id
);

INSERT INTO `sys_job` (`job_id`, `job_name`, `job_group`, `handler_key`, `handler_params`, `cron_expression`, `misfire_policy`, `concurrent`, `status`, `del_flag`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`)
SELECT 20260425001, '调度演示任务', 'SYSTEM', 'system.noop', '{"source":"bootstrap"}', '0 0/30 * * * ?', '0', '1', '1', '0', 103, 1, NOW(), 1, NOW(), '默认演示任务，创建后处于暂停状态'
WHERE NOT EXISTS (SELECT 1 FROM `sys_job` WHERE `job_id` = 20260425001);

SET FOREIGN_KEY_CHECKS = 1;

-- ========================================
-- 第三部分: 监控功能增强
-- 来源: infoq_scaffold_update_20260429.sql
-- 日期: 2026-04-29
-- 说明: 添加服务监控与连接池监控菜单
-- ========================================


INSERT INTO `sys_menu` (
    `menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`,
    `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`,
    `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`
)
SELECT
    2026042910, '服务监控', 2, 4, 'server', 'monitor/server/index', '',
    1, 0, 'C', '0', '0', 'monitor:server:list', 'server',
    103, 1, NOW(), 1, NOW(), '服务监控菜单'
WHERE NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `menu_id` = 2026042910);

INSERT INTO `sys_menu` (
    `menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`,
    `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`,
    `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`
)
SELECT
    2026042920, '连接池监控', 2, 6, 'dataSource', 'monitor/dataSource/index', '',
    1, 0, 'C', '0', '0', 'monitor:dataSource:list', 'monitor',
    103, 1, NOW(), 1, NOW(), 'Hikari 连接池监控菜单'
WHERE NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `menu_id` = 2026042920);

INSERT INTO `sys_menu` (
    `menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`,
    `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`,
    `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`
)
SELECT
    2026042911, '服务监控查询', 2026042910, 1, '#', '', '',
    1, 0, 'F', '0', '0', 'monitor:server:list', '#',
    103, 1, NOW(), 1, NOW(), ''
WHERE NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `menu_id` = 2026042911);

INSERT INTO `sys_menu` (
    `menu_id`, `menu_name`, `parent_id`, `order_num`, `path`, `component`, `query_param`,
    `is_frame`, `is_cache`, `menu_type`, `visible`, `status`, `perms`, `icon`,
    `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`
)
SELECT
    2026042921, '连接池监控查询', 2026042920, 1, '#', '', '',
    1, 0, 'F', '0', '0', 'monitor:dataSource:list', '#',
    103, 1, NOW(), 1, NOW(), ''
WHERE NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `menu_id` = 2026042921);

INSERT INTO `sys_role_menu` (`role_id`, `menu_id`)
SELECT 1, `sys_menu`.`menu_id`
FROM `sys_menu`
WHERE `sys_menu`.`menu_id` IN (2026042910, 2026042911, 2026042920, 2026042921)
  AND NOT EXISTS (
    SELECT 1
    FROM `sys_role_menu` rm
    WHERE rm.`role_id` = 1
      AND rm.`menu_id` = `sys_menu`.`menu_id`
  );

INSERT INTO `sys_role_menu` (`role_id`, `menu_id`)
SELECT 3, 2
WHERE EXISTS (
    SELECT 1
    FROM `sys_menu`
    WHERE `menu_id` = 2
)
  AND NOT EXISTS (
    SELECT 1
    FROM `sys_role_menu` rm
    WHERE rm.`role_id` = 3
      AND rm.`menu_id` = 2
  );

INSERT INTO `sys_role_menu` (`role_id`, `menu_id`)
SELECT 3, `sys_menu`.`menu_id`
FROM `sys_menu`
WHERE `sys_menu`.`menu_id` IN (2026042910, 2026042911)
  AND NOT EXISTS (
    SELECT 1
    FROM `sys_role_menu` rm
    WHERE rm.`role_id` = 3
      AND rm.`menu_id` = `sys_menu`.`menu_id`
  );

DELETE FROM `sys_role_menu`
WHERE `role_id` = 3
  AND `menu_id` IN (2026042920, 2026042921);

SET FOREIGN_KEY_CHECKS = 1;

-- ========================================
-- 第四部分: 系统配置增强
-- 来源: infoq_scaffold_update_20260526.sql
-- 日期: 2026-05-26
-- 说明: 扩展 sys_config 表字段，支持动态表单配置
-- ========================================


ALTER TABLE `sys_config`
    ADD COLUMN `value_type` varchar(20) NOT NULL DEFAULT 'text' COMMENT '参数值类型' AFTER `config_value`;

ALTER TABLE `sys_config`
    ADD COLUMN `default_value` text DEFAULT NULL COMMENT '默认值，NULL表示无默认值' AFTER `value_type`;

ALTER TABLE `sys_config`
    ADD COLUMN `group_key` varchar(50) DEFAULT NULL COMMENT '配置分组' AFTER `default_value`;

ALTER TABLE `sys_config`
    ADD COLUMN `display_order` int NOT NULL DEFAULT 0 COMMENT '显示顺序' AFTER `group_key`;

ALTER TABLE `sys_config`
    ADD COLUMN `options_json` text DEFAULT NULL COMMENT '下拉选项JSON' AFTER `display_order`;

ALTER TABLE `sys_config`
    ADD COLUMN `ui_props_json` text DEFAULT NULL COMMENT 'UI属性JSON' AFTER `options_json`;

UPDATE `sys_config`
SET `value_type` = 'switch',
    `default_value` = 'false',
    `group_key` = 'account',
    `display_order` = 10,
    `options_json` = NULL,
    `ui_props_json` = NULL
WHERE `config_key` = 'sys.account.registerUser';

UPDATE `sys_config`
SET `value_type` = 'switch',
    `default_value` = 'false',
    `group_key` = 'account',
    `display_order` = 20,
    `options_json` = NULL,
    `ui_props_json` = NULL
WHERE `config_key` = 'sys.account.inviteRegister';

UPDATE `sys_config`
SET `value_type` = 'switch',
    `default_value` = 'false',
    `group_key` = 'account',
    `display_order` = 30,
    `options_json` = NULL,
    `ui_props_json` = NULL
WHERE `config_key` = 'sys.account.forgotPassword';

UPDATE `sys_config`
SET `value_type` = 'password',
    `default_value` = '123456',
    `group_key` = 'account',
    `display_order` = 40,
    `options_json` = NULL,
    `ui_props_json` = NULL
WHERE `config_key` = 'sys.user.initPassword';

UPDATE `sys_config`
SET `value_type` = 'select',
    `default_value` = 'theme-light',
    `group_key` = 'theme',
    `display_order` = 10,
    `options_json` = '[{"label":"深色主题","value":"theme-dark"},{"label":"浅色主题","value":"theme-light"}]',
    `ui_props_json` = NULL
WHERE `config_key` = 'sys.index.sideTheme';

UPDATE `sys_config`
SET `value_type` = 'select',
    `default_value` = 'skin-purple',
    `group_key` = 'theme',
    `display_order` = 20,
    `options_json` = '[{"label":"蓝色","value":"skin-blue"},{"label":"绿色","value":"skin-green"},{"label":"紫色","value":"skin-purple"},{"label":"红色","value":"skin-red"},{"label":"黄色","value":"skin-yellow"}]',
    `ui_props_json` = NULL
WHERE `config_key` = 'sys.index.skinName';

UPDATE `sys_config`
SET `value_type` = 'switch',
    `default_value` = 'true',
    `group_key` = 'resource',
    `display_order` = 10,
    `options_json` = NULL,
    `ui_props_json` = NULL
WHERE `config_key` = 'sys.oss.previewListResource';

SET FOREIGN_KEY_CHECKS = 1;

-- ========================================
-- 第五部分: OAuth 登录与身份绑定
-- 来源: infoq_scaffold_update_20260529.sql
-- 日期: 2026-05-29
-- 说明: 添加 OAuth 平台配置与身份绑定表
-- ========================================


-- OAuth 登录：运行本脚本后需重启服务，或清理 Redis 缓存 global:sys_client#30d。
UPDATE `sys_client`
SET `grant_type` = CASE
    WHEN `grant_type` IS NULL OR `grant_type` = '' THEN 'oauth'
    WHEN FIND_IN_SET('oauth', REPLACE(`grant_type`, ' ', '')) = 0 THEN CONCAT(`grant_type`, ',oauth')
    ELSE `grant_type`
END
WHERE `client_id` = 'e5cd7e4891bf95d1d19206ce24a7b32e';

CREATE TABLE IF NOT EXISTS `sys_oauth_provider` (
    `provider_id` bigint NOT NULL COMMENT 'OAuth平台ID',
    `provider_code` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '平台编码',
    `provider_name` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '平台名称',
    `enabled` char(1) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT '1' COMMENT '是否启用（0是 1否）',
    `allow_login` char(1) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT '1' COMMENT '是否允许登录（0是 1否）',
    `allow_bind` char(1) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT '1' COMMENT '是否允许绑定（0是 1否）',
    `allow_auto_register` char(1) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT '1' COMMENT '是否允许自动注册（0是 1否）',
    `sort` int NOT NULL DEFAULT '0' COMMENT '排序',
    `remark` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '备注',
    `del_flag` char(1) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '0' COMMENT '删除标志（0代表存在 2代表删除）',
    `create_dept` bigint DEFAULT NULL COMMENT '创建部门',
    `create_by` bigint DEFAULT NULL COMMENT '创建者',
    `create_time` datetime DEFAULT NULL COMMENT '创建时间',
    `update_by` bigint DEFAULT NULL COMMENT '更新者',
    `update_time` datetime DEFAULT NULL COMMENT '更新时间',
    PRIMARY KEY (`provider_id`) USING BTREE,
    UNIQUE KEY `uk_sys_oauth_provider_code` (`provider_code`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='OAuth平台配置表';

INSERT IGNORE INTO `sys_oauth_provider` (`provider_id`, `provider_code`, `provider_name`, `enabled`, `allow_login`, `allow_bind`, `allow_auto_register`, `sort`, `remark`, `del_flag`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`) VALUES
(1, 'github', 'GitHub', '0', '0', '0', '1', 1, 'GitHub OAuth 登录', '0', 103, 1, now(), 1, now()),
(2, 'linuxdo', 'linux.do', '0', '0', '0', '1', 2, 'linux.do OAuth 登录', '0', 103, 1, now(), 1, now());

CREATE TABLE IF NOT EXISTS `sys_oauth_identity` (
    `identity_id` bigint NOT NULL COMMENT 'OAuth身份ID',
    `user_id` bigint NOT NULL COMMENT '本地用户ID',
    `provider_code` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '平台编码',
    `provider_key` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '平台应用键',
    `provider_subject` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '第三方稳定用户标识',
    `union_id` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '第三方UnionId',
    `open_id` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '第三方OpenId',
    `provider_username` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '第三方用户名',
    `provider_nickname` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '第三方昵称',
    `provider_email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '第三方邮箱',
    `provider_avatar` varchar(512) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '第三方头像',
    `email_verified` char(1) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'N' COMMENT '邮箱是否验证（Y是 N否）',
    `metadata_json` json DEFAULT NULL COMMENT '第三方原始信息',
    `status` char(1) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT '0' COMMENT '状态（0正常 1停用）',
    `last_login_time` datetime DEFAULT NULL COMMENT '最后登录时间',
    `del_flag` char(1) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '0' COMMENT '删除标志（0代表存在 2代表删除）',
    `create_dept` bigint DEFAULT NULL COMMENT '创建部门',
    `create_by` bigint DEFAULT NULL COMMENT '创建者',
    `create_time` datetime DEFAULT NULL COMMENT '创建时间',
    `update_by` bigint DEFAULT NULL COMMENT '更新者',
    `update_time` datetime DEFAULT NULL COMMENT '更新时间',
    PRIMARY KEY (`identity_id`) USING BTREE,
    UNIQUE KEY `uk_sys_oauth_identity_subject` (`provider_code`, `provider_key`, `provider_subject`) USING BTREE,
    UNIQUE KEY `uk_sys_oauth_identity_user_provider` (`user_id`, `provider_code`, `provider_key`) USING BTREE,
    KEY `idx_sys_oauth_identity_user_id` (`user_id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='OAuth身份绑定表';

SET @oauth_dict_code = IF(
    EXISTS (SELECT 1 FROM `sys_dict_data` WHERE `dict_code` = 34),
    (SELECT COALESCE(MAX(`dict_code`), 0) + 1 FROM `sys_dict_data`),
    34
);

INSERT INTO `sys_dict_data` (`dict_code`, `dict_sort`, `dict_label`, `dict_value`, `dict_type`, `css_class`, `list_class`, `is_default`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`)
SELECT @oauth_dict_code, 0, 'OAuth认证', 'oauth', 'sys_grant_type', 'el-check-tag', 'default', 'N', 103, 1, now(), NULL, now(), 'OAuth认证'
WHERE NOT EXISTS (
    SELECT 1 FROM `sys_dict_data` WHERE `dict_type` = 'sys_grant_type' AND `dict_value` = 'oauth'
);

SET FOREIGN_KEY_CHECKS = 1;

-- ========================================
-- 第六部分: 微信小程序登录与消息盒子
-- 来源: infoq_scaffold_update_20260713.sql
-- 日期: 2026-07-13
-- 说明: 添加微信小程序 OAuth、消息盒子功能
-- ========================================

-- P1/P2: OAuth 身份关系与微信小程序登录。
-- 目标表：sys_client、sys_oauth_provider、sys_oauth_identity。
-- 执行后清理 Redis 键 global:sys_client#30d，使新增 miniapp grant type 立即生效。

-- 将冻结初始化基线中的小程序客户端标识和授权类型统一为 miniapp；重复执行不重复追加授权类型。
UPDATE `sys_client`
SET `client_key` = 'miniapp',
    `client_secret` = 'miniapp123',
    `device_type` = 'miniapp',
    `update_time` = NOW()
WHERE `client_id` = 'edda41a953c4a2604febf8a305b441ce' AND `del_flag` = '0';

-- 冻结初始化基线保留旧字典值；新功能脚本执行时将小程序认证字典直接设为 miniapp。
UPDATE `sys_dict_data`
SET `dict_value` = 'miniapp',
    `update_time` = NOW()
WHERE `dict_type` = 'sys_grant_type'
  AND `dict_label` = '小程序认证'
  AND `dict_value` = 'xcx';

-- 将冻结初始化基线中的小程序设备类型字典值直接设为 miniapp。
UPDATE `sys_dict_data`
SET `dict_value` = 'miniapp',
    `update_time` = NOW()
WHERE `dict_type` = 'sys_device_type'
  AND `dict_label` = '小程序'
  AND `dict_value` = 'weapp';

-- Provider 默认禁用；启用微信登录前必须同时配置 infoq.auth.wechat-miniapp 和该 Provider。
INSERT IGNORE INTO `sys_oauth_provider`
(`provider_id`, `provider_code`, `provider_name`, `enabled`, `allow_login`, `allow_bind`, `allow_auto_register`, `sort`, `remark`, `del_flag`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`)
VALUES
(9001, 'wechat_miniapp', '微信小程序', '1', '1', '1', '1', 100, '由部署配置控制，默认禁用', '0', 103, 1, NOW(), 1, NOW());

-- 验证查询：
-- SELECT client_id, client_key, client_secret, grant_type, device_type FROM sys_client WHERE client_id = 'edda41a953c4a2604febf8a305b441ce' AND del_flag = '0';
-- SELECT provider_code, enabled, allow_login, allow_bind, allow_auto_register FROM sys_oauth_provider WHERE provider_code = 'wechat_miniapp';

-- 回滚说明：若未创建任何微信身份记录，可手动移除 miniapp grant 并删除 Provider；
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
    KEY `idx_sys_message_recipient_inbox` (`user_id`, `delete_time`, `read_time`, `message_id`),
    KEY `idx_sys_message_recipient_delete_time` (`delete_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统消息接收人';


-- 验证查询：
-- SELECT COUNT(*) AS unread_count FROM sys_message_recipient WHERE user_id = ? AND read_time IS NULL AND delete_time IS NULL;
-- SELECT message_id, user_id, read_time, delete_time FROM sys_message_recipient WHERE user_id = ? ORDER BY message_id DESC LIMIT 20;
-- 默认暂停的每日清理任务；仅在任务启用且 infoq.message.cleanup.enabled=true 时才会实际清理。
INSERT INTO `sys_job` (`job_id`, `job_name`, `job_group`, `handler_key`, `handler_params`, `cron_expression`, `misfire_policy`, `concurrent`, `status`, `del_flag`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`)
SELECT 20260713001, '消息盒子清理任务', 'SYSTEM', 'system.message.cleanup', NULL, '0 30 3 * * ?', '3', '1', '1', '0', 103, 1, NOW(), 1, NOW(), '默认暂停；启用前必须确认消息保留期与 infoq.message.cleanup.enabled=true'
WHERE NOT EXISTS (SELECT 1 FROM `sys_job` WHERE `job_id` = 20260713001);

-- 回滚说明：先关闭 infoq.push.enabled 并下线公告消息生产入口；历史消息保留到保留期结束后再独立清理。
-- 清理任务默认暂停，并且仅在 infoq.message.cleanup.enabled=true 时运行；它不会删除未过期消息或未软删除收件记录。

-- ========================================
-- 脚本执行完成
-- ========================================
SET FOREIGN_KEY_CHECKS = 1;

-- 执行后操作说明:
-- 1. 清理 Redis 缓存: DEL global:sys_client#30d
-- 2. 重启应用服务以加载新配置
-- 3. 验证菜单权限是否正确分配
-- 4. 检查定时任务是否正常调度
-- ========================================
