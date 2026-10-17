# 管理端 E2E 测试

本文件固定管理端浏览器自动化（`test-cli`）的测试数据、选择器与 cleanup 政策，并索引 case 集合。执行入口与命令见 [Skills 与插件](./SKILLS.md) 第 8.1 节。

## 1. Case 集合

| 文件 | 说明 |
| --- | --- |
| [case-matrix.md](./testing/case-matrix.md) | 测试矩阵总览 |
| [case-matrix.json](./testing/case-matrix.json) | 测试矩阵数据（`validate-case-matrix.mjs` 校验对象） |
| [e2e-cases.md](./testing/e2e-cases.md) | 端到端用例 |
| [whitebox-cases.md](./testing/whitebox-cases.md) | 白盒用例 |
| [gaps.md](./testing/gaps.md) | 当前覆盖缺口 |

## 2. 测试数据策略

### 2.1 默认策略

Phase 1 和只读 smoke 不创建测试数据。所有写入型 E2E 默认延期，只有在隔离环境或显式授权后才允许执行。

### 2.2 命名规则

自动化写入数据必须使用 `e2e_` 前缀：

```text
e2e_<module>_<timestamp>_<short-random>
```

禁止修改系统内置管理员、默认角色、默认菜单、默认配置和非 `e2e_` 数据。

### 2.3 数据来源

优先通过 UI 创建真实测试数据。需要 seed 时必须显式标记为测试 fixture，不得修改 `sql/infoq_scaffold_3.0.0.sql`。

### 2.4 高副作用数据

OSS 文件、OSS 配置、定时任务执行状态、非当前 run 在线会话、缓存键、账号锁定状态和批量删除目标默认 P2，执行前必须有门禁确认。在线强退只能使用当前 run 创建的 `e2e_` 用户会话 fixture，不得强退默认账号或共享在线用户。

### 2.5 报告要求

写入型用例必须在报告中记录创建数据、唯一键、清理动作、清理结果和残留风险。

## 3. 选择器策略

### 3.1 优先级

1. 可访问名称：按钮文本、表单 label、菜单文本和弹窗标题。
2. 稳定业务文本：表格列名、模块标题、确认/取消按钮组合。
3. 稳定属性：已有 `data-*`、`aria-*` 或业务标识。
4. 局部结构选择器：仅在没有稳定语义时使用，并限制在当前模块容器内。

### 3.2 React / Ant Design

React 默认优先使用 Testing Library 和 Playwright 的 role/name 查询。禁止依赖 Ant Design 或 ProComponents 生成的动态 class、内部层级和图标顺序。

### 3.3 Vue / Element Plus

Vue 默认优先使用按钮文本、表单 label、表格列名和 `el-dialog` 标题。禁止依赖 Element Plus 生成的动态 class 和内部 DOM 层级。

### 3.4 data-testid 策略

只有当业务语义不足以稳定定位时才补 `data-testid`。补充前必须列出目标模块、目标元素和替代方案；不得为了测试便利大面积重写 UI。

### 3.5 点击路径记录

点击路径必须记录 action、selector、label、client、route、case id 和 timestamp。不得只记录坐标。

## 4. Cleanup 策略

### 4.1 必须清理的场景

新增用户、角色、部门、岗位、字典、公告、客户端、邀请码、上传文件、OSS 配置、定时任务、在线强退 `e2e_` 用户 fixture 和可持久化配置变更都必须清理。

### 4.2 清理顺序

1. 优先通过 UI 删除当前用例创建的数据。
2. UI 清理失败时记录 API 或数据库人工回滚提示。
3. 仍无法清理时在报告中标记 residual risk。

### 4.3 失败处理

cleanup 失败不得被静默忽略。报告必须包含模块名、测试数据唯一键、已执行清理动作、失败原因和人工回滚建议。

### 4.4 禁止行为

不得删除非 `e2e_` 数据，不得批量清空表，不得修改冻结初始化 SQL，不得为了清理方便修改产品删除逻辑。

## 5. 验证码自动化

管理端 E2E 使用 Redis 种子答案，不依赖图片识别工具。`captcha_login.mjs` 先请求 `/auth/code` 获取 `uuid`，再向**后端正在使用的 Redis**写入同一 `uuid` 的已知答案，最后正常提交 `/auth/login`。验证码图片和登录校验仍走真实后端逻辑。

```bash
INFOQ_TEST_REDIS_HOST=127.0.0.1 \
INFOQ_TEST_REDIS_PORT=6379 \
INFOQ_TEST_REDIS_DATABASE=0 \
INFOQ_TEST_REDIS_PASSWORD="$REDIS_PASSWORD" \
node skills/test-cli/scripts/captcha_login.mjs --backend-url http://127.0.0.1:8080 --print-token
```

也支持 `--redis-host`、`--redis-port`、`--redis-database`、`--redis-username`、`--redis-password`、`--redis-tls`、`--redis-key-prefix`。答案默认 `2468`，可用 `--captcha-answer` 覆盖。

约束：

- 测试进程与后端必须使用同一个 Redis 实例和 DB。
- 如果后端配置了 `redisson.keyPrefix`，`--redis-key-prefix` 必须包含相同前缀。
- 该模式只允许在已授权的测试环境使用，禁止指向生产 Redis。
- 种子 key 与后端校验一致，TTL 默认 120 秒，只能消费一次。
