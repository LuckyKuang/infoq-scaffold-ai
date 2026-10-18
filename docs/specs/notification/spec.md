# 通知与实时提醒规范

## 目标

定义当前仓库的通知公告管理、公告创建后的持久化消息与提交后实时刷新，以及管理端的 SSE / WebSocket 提醒入口。

## 要求

### 要求：公告管理入口
通知公告必须继续通过统一后台接口维护。

#### 场景：查询或维护公告

- 当管理员操作通知公告时
- 则必须继续使用 `/system/notice/list`、`/system/notice/{noticeId}`、`POST /system/notice`、`PUT /system/notice`、`DELETE /system/notice/{noticeIds}`
- 并且权限标识必须继续使用 `system:notice:*`

### 要求：新增公告后创建持久化提醒
成功创建公告后必须在同一事务内为正常用户创建个人消息接收记录，并仅在提交后尝试发送刷新事件。

#### 场景：新增公告成功

- 当 `POST /system/notice` 插入成功时
- 则系统必须批量创建 `sys_message` 与 `sys_message_recipient` 记录
- 并且实时事件只可包含 `{ type: "message", messageId }` 所需的刷新信息，且 `messageId` 必须为十进制字符串以保持 64 位 ID 精确
- 并且 Push 关闭、通道不可用或用户离线时，新增公告流程不得失败

### 要求：前端提醒通道开关
管理端的实时通道必须受环境开关和 token 状态控制。

#### 场景：初始化实时通道

- 当 React 或 Vue 管理端初始化实时提醒时
- 则只有在 `VITE_APP_SSE=true` 时才允许连接 `/resource/sse`
- 并且只有在 `VITE_APP_WEBSOCKET=true` 时才允许连接 `/resource/websocket`
- 并且缺少 token 时必须跳过连接而不是伪造成功

### 要求：提醒展示
管理端通知 store 必须以服务端个人消息和未读数为真值；实时事件只能触发刷新，不得存储正文。

#### 场景：收到实时消息

- 当管理端收到 SSE 或 WebSocket 消息时
- 则仅当事件为 `{ type: "message" }` 时刷新个人消息列表与未读数
- 并且布局层未读计数和通知面板必须基于服务端 message store 展示

### 要求：用户持久化消息盒子
系统必须为每位接收人持久化消息投递与阅读状态，并以当前认证用户限制读取范围。

#### 场景：用户读取离线消息

- 当用户请求个人消息分页或未读数量时
- 则系统必须只返回该用户未软删除的接收记录
- 并且不得依赖 SSE、WebSocket 或用户在线状态

#### 场景：标记消息已读或删除

- 当用户标记消息已读、全部已读或删除消息时
- 则系统必须仅更新该用户的接收记录
- 并且不得修改其他用户的阅读或删除状态

### 要求：事务后实时 Push

系统必须仅在消息与接收记录成功提交后执行异步 Push；关闭、通道不可用、可证实离线或发送异常必须不反转已提交的公告和持久化消息，且必须记录安全、准确的结果分类。

#### 场景：Push 关闭或无可用通道

- 当提交后事件发生，而 Push 插件关闭或没有可用通道。
- 则系统必须保持主业务成功，记录 disabled 或 channel_unavailable 等明确分类，以及 correlation ID、message ID、接收人数与通道状态。
- 并且日志必须不包含消息正文、token 或用户明细。

#### 场景：通道异常

- 当SSE 或 WebSocket 通道发送抛出异常。
- 则系统必须记录失败通道、异常类别及关联字段；一个通道的结果必须不冒充其他通道成功。
- 并且提交后的持久化消息必须仍可按用户权限读取，异步异常必须不反转原事务。

#### 场景：发布与客户端投递的证据不同

- 当仅能证实向 Redis/通道发布成功而不能证实客户端收到。
- 则系统必须记录 published 或等价的准确状态，必须 不宣称 delivered。
- 并且连接状态可确定为离线时必须记录 offline；跨节点或状态不可确定时必须记录 unknown，必须 不把未知伪装为在线或离线。

#### 场景：Push 插件关闭

- 当 `infoq.push.enabled=false` 时
- 则系统不得创建 Push 通道适配器
- 并且个人消息盒子读取、已读和删除能力必须仍可用

## 实现符合性与待补证据

`SysNoticeServiceImpl`、`SysMessageServiceImpl` 与 `SysMessagePushListener` 使用公告事务内持久化和 `AFTER_COMMIT` 异步 Push；正常用户集合为空时不创建无接收人的消息。Push 逐通道记录安全的发布/失败分类；无客户端 ACK 时只报告发布，连接状态无法确认时保持 unknown。WebSocket 接收人节点与心跳核验使用有限批量 Redis 操作，不逐人查询。

消息接口以当前登录用户限制范围：`GET /system/message/list`、`GET /system/message/unread-count`、`POST /system/message/{messageId}/read`、`POST /system/message/read-all`、`DELETE /system/message/{messageIds}`。真实离线读取、通道故障、容量与告警演练仍需在隔离运行环境补证据。
