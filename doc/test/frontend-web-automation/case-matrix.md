# 管理端 Web 自动化测试矩阵

生成时间：2026-07-04T03:47:59.038Z

## 摘要

- 用例总数：114
- P0：24
- P1：69
- P2：21
- React 适用用例：114
- React Pro 适用用例：114
- Vue 适用用例：114
- 副作用用例：51
- 缺口数：0

## 用例清单

| ID | 优先级 | 类型 | 模块 | 名称 | 路由 | 组件 | 客户端 | 副作用 | 缺口 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FE-AUTH-FORGOT-PASSWORD | P1 | smoke | auth.forgot-password | 忘记密码 | /forgot-password | forgot-password | react,react-pro,vue | no |  |
| FE-AUTH-LOGIN | P0 | smoke | auth.login | 登录 | /login | login | react,react-pro,vue | no |  |
| FE-AUTH-OAUTH-CALLBACK | P1 | smoke | auth.oauth-callback | OAuth 回调 | /oauth/callback | oauth-callback | react,react-pro,vue | no |  |
| FE-AUTH-REGISTER | P1 | smoke | auth.register | 注册 | /register | register | react,react-pro,vue | no |  |
| FE-ERROR-401 | P0 | smoke | error.401 | 401 | /401 | error/401 | react,react-pro,vue | no |  |
| FE-ERROR-404 | P0 | smoke | error.404 | 404 | /404 | error/404 | react,react-pro,vue | no |  |
| FE-HOME-INDEX | P0 | smoke | home.index | 首页 | /index | index | react,react-pro,vue | no |  |
| FE-MONITOR-2 | P1 | route | monitor | 系统监控 | /monitor |  | react,react-pro,vue | no |  |
| FE-MONITOR-CACHE-113 | P0 | smoke | monitor.cache | 缓存监控 | /monitor/cache | monitor/cache/index | react,react-pro,vue | no |  |
| FE-MONITOR-DATA-SOURCE-2026042920 | P0 | smoke | monitor.dataSource | 连接池监控 | /monitor/dataSource | monitor/dataSource/index | react,react-pro,vue | no |  |
| FE-MONITOR-DATA-SOURCE-2026042921 | P1 | permission | monitor.dataSource | 连接池监控查询 | /monitor/dataSource | monitor/dataSource/index | react,react-pro,vue | no |  |
| FE-MONITOR-JOB-2026042510 | P0 | smoke | monitor.job | 定时任务 | /monitor/job | monitor/job/index | react,react-pro,vue | no |  |
| FE-MONITOR-JOB-2026042511 | P1 | permission | monitor.job | 任务查询 | /monitor/job | monitor/job/index | react,react-pro,vue | no |  |
| FE-MONITOR-JOB-2026042512 | P1 | CRUD | monitor.job | 任务新增 | /monitor/job | monitor/job/index | react,react-pro,vue | yes |  |
| FE-MONITOR-JOB-2026042513 | P1 | CRUD | monitor.job | 任务修改 | /monitor/job | monitor/job/index | react,react-pro,vue | yes |  |
| FE-MONITOR-JOB-2026042514 | P2 | CRUD | monitor.job | 任务删除 | /monitor/job | monitor/job/index | react,react-pro,vue | yes |  |
| FE-MONITOR-JOB-2026042515 | P1 | CRUD | monitor.job | 任务导出 | /monitor/job | monitor/job/index | react,react-pro,vue | no |  |
| FE-MONITOR-JOB-2026042516 | P1 | CRUD | monitor.job | 状态切换 | /monitor/job | monitor/job/index | react,react-pro,vue | yes |  |
| FE-MONITOR-JOB-2026042517 | P2 | CRUD | monitor.job | 立即执行 | /monitor/job | monitor/job/index | react,react-pro,vue | yes |  |
| FE-MONITOR-JOB-LOG-2026042520 | P0 | smoke | monitor.jobLog | 任务日志 | /monitor/jobLog | monitor/jobLog/index | react,react-pro,vue | no |  |
| FE-MONITOR-JOB-LOG-2026042521 | P1 | permission | monitor.jobLog | 日志查询 | /monitor/jobLog | monitor/jobLog/index | react,react-pro,vue | no |  |
| FE-MONITOR-JOB-LOG-2026042522 | P2 | CRUD | monitor.jobLog | 日志删除 | /monitor/jobLog | monitor/jobLog/index | react,react-pro,vue | yes |  |
| FE-MONITOR-JOB-LOG-2026042523 | P1 | CRUD | monitor.jobLog | 日志导出 | /monitor/jobLog | monitor/jobLog/index | react,react-pro,vue | no |  |
| FE-MONITOR-JOB-LOG-2026042524 | P2 | CRUD | monitor.jobLog | 日志清空 | /monitor/jobLog | monitor/jobLog/index | react,react-pro,vue | yes |  |
| FE-MONITOR-LOGIN-INFO-1043 | P1 | permission | monitor.loginInfo | 登录查询 | /system/log/loginInfo | monitor/loginInfo/index | react,react-pro,vue | no |  |
| FE-MONITOR-LOGIN-INFO-1044 | P2 | CRUD | monitor.loginInfo | 登录删除 | /system/log/loginInfo | monitor/loginInfo/index | react,react-pro,vue | yes |  |
| FE-MONITOR-LOGIN-INFO-1045 | P1 | CRUD | monitor.loginInfo | 日志导出 | /system/log/loginInfo | monitor/loginInfo/index | react,react-pro,vue | no |  |
| FE-MONITOR-LOGIN-INFO-1050 | P2 | CRUD | monitor.loginInfo | 账户解锁 | /system/log/loginInfo | monitor/loginInfo/index | react,react-pro,vue | yes |  |
| FE-MONITOR-LOGIN-INFO-501 | P0 | smoke | monitor.loginInfo | 登录日志 | /system/log/loginInfo | monitor/loginInfo/index | react,react-pro,vue | no |  |
| FE-MONITOR-ONLINE-1046 | P1 | permission | monitor.online | 在线查询 | /monitor/online | monitor/online/index | react,react-pro,vue | no |  |
| FE-MONITOR-ONLINE-1047 | P2 | CRUD | monitor.online | 批量强退 | /monitor/online | monitor/online/index | react,react-pro,vue | yes |  |
| FE-MONITOR-ONLINE-1048 | P2 | CRUD | monitor.online | 单条强退 | /monitor/online | monitor/online/index | react,react-pro,vue | yes |  |
| FE-MONITOR-ONLINE-109 | P0 | smoke | monitor.online | 在线用户 | /monitor/online | monitor/online/index | react,react-pro,vue | no |  |
| FE-MONITOR-OPER-LOG-1040 | P1 | permission | monitor.operLog | 操作查询 | /system/log/operLog | monitor/operLog/index | react,react-pro,vue | no |  |
| FE-MONITOR-OPER-LOG-1041 | P2 | CRUD | monitor.operLog | 操作删除 | /system/log/operLog | monitor/operLog/index | react,react-pro,vue | yes |  |
| FE-MONITOR-OPER-LOG-1042 | P1 | CRUD | monitor.operLog | 日志导出 | /system/log/operLog | monitor/operLog/index | react,react-pro,vue | no |  |
| FE-MONITOR-OPER-LOG-500 | P0 | smoke | monitor.operLog | 操作日志 | /system/log/operLog | monitor/operLog/index | react,react-pro,vue | no |  |
| FE-MONITOR-SERVER-2026042910 | P0 | smoke | monitor.server | 服务监控 | /monitor/server | monitor/server/index | react,react-pro,vue | no |  |
| FE-MONITOR-SERVER-2026042911 | P1 | permission | monitor.server | 服务监控查询 | /monitor/server | monitor/server/index | react,react-pro,vue | no |  |
| FE-ROUTE-REDIRECT | P0 | smoke | route.redirect | 路由跳转 | /redirect/:path* | redirect/index | react,react-pro,vue | no |  |
| FE-SYSTEM-1 | P1 | route | system | 系统管理 | /system |  | react,react-pro,vue | no |  |
| FE-SYSTEM-CLIENT-1061 | P1 | permission | system.client | 客户端管理查询 | /system/client | system/client/index | react,react-pro,vue | no |  |
| FE-SYSTEM-CLIENT-1062 | P1 | CRUD | system.client | 客户端管理新增 | /system/client | system/client/index | react,react-pro,vue | yes |  |
| FE-SYSTEM-CLIENT-1063 | P1 | CRUD | system.client | 客户端管理修改 | /system/client | system/client/index | react,react-pro,vue | yes |  |
| FE-SYSTEM-CLIENT-1064 | P2 | CRUD | system.client | 客户端管理删除 | /system/client | system/client/index | react,react-pro,vue | yes |  |
| FE-SYSTEM-CLIENT-1065 | P1 | CRUD | system.client | 客户端管理导出 | /system/client | system/client/index | react,react-pro,vue | no |  |
| FE-SYSTEM-CLIENT-123 | P0 | smoke | system.client | 客户端管理 | /system/client | system/client/index | react,react-pro,vue | no |  |
| FE-SYSTEM-CONFIG-1031 | P1 | permission | system.config | 参数查询 | /system/config | system/config/index | react,react-pro,vue | no |  |
| FE-SYSTEM-CONFIG-1032 | P1 | CRUD | system.config | 参数新增 | /system/config | system/config/index | react,react-pro,vue | yes |  |
| FE-SYSTEM-CONFIG-1033 | P1 | CRUD | system.config | 参数修改 | /system/config | system/config/index | react,react-pro,vue | yes |  |
| FE-SYSTEM-CONFIG-1034 | P2 | CRUD | system.config | 参数删除 | /system/config | system/config/index | react,react-pro,vue | yes |  |
| FE-SYSTEM-CONFIG-1035 | P1 | CRUD | system.config | 参数导出 | /system/config | system/config/index | react,react-pro,vue | no |  |
| FE-SYSTEM-CONFIG-106 | P0 | smoke | system.config | 参数设置 | /system/config | system/config/index | react,react-pro,vue | no |  |
| FE-SYSTEM-DEPT-1017 | P1 | permission | system.dept | 部门查询 | /system/dept | system/dept/index | react,react-pro,vue | no |  |
| FE-SYSTEM-DEPT-1018 | P1 | CRUD | system.dept | 部门新增 | /system/dept | system/dept/index | react,react-pro,vue | yes |  |
| FE-SYSTEM-DEPT-1019 | P1 | CRUD | system.dept | 部门修改 | /system/dept | system/dept/index | react,react-pro,vue | yes |  |
| FE-SYSTEM-DEPT-1020 | P2 | CRUD | system.dept | 部门删除 | /system/dept | system/dept/index | react,react-pro,vue | yes |  |
| FE-SYSTEM-DEPT-103 | P0 | smoke | system.dept | 部门管理 | /system/dept | system/dept/index | react,react-pro,vue | no |  |
| FE-SYSTEM-DICT-1026 | P1 | permission | system.dict | 字典查询 | /system/dict | system/dict/index | react,react-pro,vue | no |  |
| FE-SYSTEM-DICT-1027 | P1 | CRUD | system.dict | 字典新增 | /system/dict | system/dict/index | react,react-pro,vue | yes |  |
| FE-SYSTEM-DICT-1028 | P1 | CRUD | system.dict | 字典修改 | /system/dict | system/dict/index | react,react-pro,vue | yes |  |
| FE-SYSTEM-DICT-1029 | P2 | CRUD | system.dict | 字典删除 | /system/dict | system/dict/index | react,react-pro,vue | yes |  |
| FE-SYSTEM-DICT-1030 | P1 | CRUD | system.dict | 字典导出 | /system/dict | system/dict/index | react,react-pro,vue | no |  |
| FE-SYSTEM-DICT-105 | P0 | smoke | system.dict | 字典管理 | /system/dict | system/dict/index | react,react-pro,vue | no |  |
| FE-SYSTEM-DICT-DATA-132 | P1 | route | system.dict.data | 字典数据 | /system/dict-data/index/:dictId | system/dict/data | react,react-pro,vue | no |  |
| FE-SYSTEM-INVITE-1066 | P1 | CRUD | system.invite | 邀请码管理新增 | /system/invite | system/invite/index | react,react-pro,vue | yes |  |
| FE-SYSTEM-INVITE-1067 | P1 | CRUD | system.invite | 邀请码管理修改 | /system/invite | system/invite/index | react,react-pro,vue | yes |  |
| FE-SYSTEM-INVITE-1068 | P2 | CRUD | system.invite | 邀请码管理删除 | /system/invite | system/invite/index | react,react-pro,vue | yes |  |
| FE-SYSTEM-INVITE-1069 | P1 | CRUD | system.invite | 邀请码管理导出 | /system/invite | system/invite/index | react,react-pro,vue | no |  |
| FE-SYSTEM-INVITE-124 | P0 | smoke | system.invite | 邀请码管理 | /system/invite | system/invite/index | react,react-pro,vue | no |  |
| FE-SYSTEM-LOG-108 | P1 | route | system.log | 日志管理 | /system/log |  | react,react-pro,vue | no |  |
| FE-SYSTEM-MENU-1013 | P1 | permission | system.menu | 菜单查询 | /system/menu | system/menu/index | react,react-pro,vue | no |  |
| FE-SYSTEM-MENU-1014 | P1 | CRUD | system.menu | 菜单新增 | /system/menu | system/menu/index | react,react-pro,vue | yes |  |
| FE-SYSTEM-MENU-1015 | P1 | CRUD | system.menu | 菜单修改 | /system/menu | system/menu/index | react,react-pro,vue | yes |  |
| FE-SYSTEM-MENU-1016 | P2 | CRUD | system.menu | 菜单删除 | /system/menu | system/menu/index | react,react-pro,vue | yes |  |
| FE-SYSTEM-MENU-102 | P0 | smoke | system.menu | 菜单管理 | /system/menu | system/menu/index | react,react-pro,vue | no |  |
| FE-SYSTEM-NOTICE-1036 | P1 | permission | system.notice | 公告查询 | /system/notice | system/notice/index | react,react-pro,vue | no |  |
| FE-SYSTEM-NOTICE-1037 | P1 | CRUD | system.notice | 公告新增 | /system/notice | system/notice/index | react,react-pro,vue | yes |  |
| FE-SYSTEM-NOTICE-1038 | P1 | CRUD | system.notice | 公告修改 | /system/notice | system/notice/index | react,react-pro,vue | yes |  |
| FE-SYSTEM-NOTICE-1039 | P2 | CRUD | system.notice | 公告删除 | /system/notice | system/notice/index | react,react-pro,vue | yes |  |
| FE-SYSTEM-NOTICE-107 | P0 | smoke | system.notice | 通知公告 | /system/notice | system/notice/index | react,react-pro,vue | no |  |
| FE-SYSTEM-OSS-118 | P0 | smoke | system.oss | 文件管理 | /system/oss | system/oss/index | react,react-pro,vue | no |  |
| FE-SYSTEM-OSS-1600 | P1 | permission | system.oss | 文件查询 | /system/oss | system/oss/index | react,react-pro,vue | no |  |
| FE-SYSTEM-OSS-1601 | P1 | CRUD | system.oss | 文件上传 | /system/oss | system/oss/index | react,react-pro,vue | yes |  |
| FE-SYSTEM-OSS-1602 | P1 | CRUD | system.oss | 文件下载 | /system/oss | system/oss/index | react,react-pro,vue | no |  |
| FE-SYSTEM-OSS-1603 | P2 | CRUD | system.oss | 文件删除 | /system/oss | system/oss/index | react,react-pro,vue | yes |  |
| FE-SYSTEM-OSS-1620 | P1 | permission | system.oss | 配置列表 | /system/oss | system/oss/index | react,react-pro,vue | no |  |
| FE-SYSTEM-OSS-1621 | P1 | CRUD | system.oss | 配置添加 | /system/oss | system/oss/index | react,react-pro,vue | yes |  |
| FE-SYSTEM-OSS-1622 | P1 | CRUD | system.oss | 配置编辑 | /system/oss | system/oss/index | react,react-pro,vue | yes |  |
| FE-SYSTEM-OSS-1623 | P2 | CRUD | system.oss | 配置删除 | /system/oss | system/oss/index | react,react-pro,vue | yes |  |
| FE-SYSTEM-OSS-CONFIG-133 | P1 | route | system.oss.config | 文件配置管理 | /system/oss-config/index | system/oss/config | react,react-pro,vue | no |  |
| FE-SYSTEM-POST-1021 | P1 | permission | system.post | 岗位查询 | /system/post | system/post/index | react,react-pro,vue | no |  |
| FE-SYSTEM-POST-1022 | P1 | CRUD | system.post | 岗位新增 | /system/post | system/post/index | react,react-pro,vue | yes |  |
| FE-SYSTEM-POST-1023 | P1 | CRUD | system.post | 岗位修改 | /system/post | system/post/index | react,react-pro,vue | yes |  |
| FE-SYSTEM-POST-1024 | P2 | CRUD | system.post | 岗位删除 | /system/post | system/post/index | react,react-pro,vue | yes |  |
| FE-SYSTEM-POST-1025 | P1 | CRUD | system.post | 岗位导出 | /system/post | system/post/index | react,react-pro,vue | no |  |
| FE-SYSTEM-POST-104 | P0 | smoke | system.post | 岗位管理 | /system/post | system/post/index | react,react-pro,vue | no |  |
| FE-SYSTEM-ROLE-1008 | P1 | permission | system.role | 角色查询 | /system/role | system/role/index | react,react-pro,vue | no |  |
| FE-SYSTEM-ROLE-1009 | P1 | CRUD | system.role | 角色新增 | /system/role | system/role/index | react,react-pro,vue | yes |  |
| FE-SYSTEM-ROLE-101 | P0 | smoke | system.role | 角色管理 | /system/role | system/role/index | react,react-pro,vue | no |  |
| FE-SYSTEM-ROLE-1010 | P1 | CRUD | system.role | 角色修改 | /system/role | system/role/index | react,react-pro,vue | yes |  |
| FE-SYSTEM-ROLE-1011 | P2 | CRUD | system.role | 角色删除 | /system/role | system/role/index | react,react-pro,vue | yes |  |
| FE-SYSTEM-ROLE-1012 | P1 | CRUD | system.role | 角色导出 | /system/role | system/role/index | react,react-pro,vue | no |  |
| FE-SYSTEM-ROLE-AUTH-USER-130 | P1 | route | system.role.authUser | 分配用户 | /system/role-auth/user/:roleId | system/role/authUser | react,react-pro,vue | yes |  |
| FE-SYSTEM-USER-100 | P0 | smoke | system.user | 用户管理 | /system/user | system/user/index | react,react-pro,vue | no |  |
| FE-SYSTEM-USER-1001 | P1 | permission | system.user | 用户查询 | /system/user | system/user/index | react,react-pro,vue | no |  |
| FE-SYSTEM-USER-1002 | P1 | CRUD | system.user | 用户新增 | /system/user | system/user/index | react,react-pro,vue | yes |  |
| FE-SYSTEM-USER-1003 | P1 | CRUD | system.user | 用户修改 | /system/user | system/user/index | react,react-pro,vue | yes |  |
| FE-SYSTEM-USER-1004 | P2 | CRUD | system.user | 用户删除 | /system/user | system/user/index | react,react-pro,vue | yes |  |
| FE-SYSTEM-USER-1005 | P1 | CRUD | system.user | 用户导出 | /system/user | system/user/index | react,react-pro,vue | no |  |
| FE-SYSTEM-USER-1006 | P1 | CRUD | system.user | 用户导入 | /system/user | system/user/index | react,react-pro,vue | yes |  |
| FE-SYSTEM-USER-1007 | P1 | CRUD | system.user | 重置密码 | /system/user | system/user/index | react,react-pro,vue | yes |  |
| FE-SYSTEM-USER-AUTH-ROLE-131 | P1 | route | system.user.authRole | 分配角色 | /system/user-auth/role/:userId | system/user/authRole | react,react-pro,vue | yes |  |
| FE-SYSTEM-USER-PROFILE | P1 | smoke | system.user.profile | 个人中心 | /user/profile | system/user/profile/index | react,react-pro,vue | no |  |

