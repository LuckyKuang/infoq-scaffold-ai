# 管理端与前端测试

本文件固定管理端浏览器自动化、前端单测/构建（`test-cli`）的测试数据、选择器、cleanup 政策与执行入口，并索引 case 集合。执行入口与命令见 [Skills 与插件](./SKILLS.md) 第 8.1、8.2 节。

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

静态矩阵检查和业务只读 smoke 不创建业务 fixture。验证码种子登录（包括 `admin-route-probe --list-routes`）仍会写 Redis、创建会话并产生登录记录，必须限定在已授权测试环境；不能把它当成生产只读探测。写入型 E2E 只有在隔离且已授权的测试环境、目标与 cleanup 明确后才允许执行。

### 2.2 命名规则

自动化写入数据必须使用 `e2e_` 前缀：

```text
e2e_<client>_<stage>_<module>_<random>
```

CRUD runner 保留完整 10 位十六进制随机后缀；字段长度不足时只截断可读前缀。不同客户端和新增/编辑阶段可区分，最短用户名也保留全部 40-bit 随机量。写入前按当前 run 的精确键查询 DB；已存在或查询失败即停止，不预先删除可能属于其他 run 的数据。

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
2. CRUD runner 在正常、失败和可捕获信号退出时，以当前 run 的精确键执行 API cleanup，再查询 DB 核对活动记录；恢复阶段有独立 30 秒总时限。
3. 清理失败、查询失败或残留未知均使该 run 失败，保存人工恢复提示；硬终止、掉电或恢复超时后按 `test-data.json` 和 [数据运维](./DATA-OPS.md) 人工核对。

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
- `--redis-key-prefix` 是完整验证码键前缀，默认 `global:captcha_codes:`。如果后端 `redisson.keyPrefix=example`，应使用 `example:global:captcha_codes:`；脚本会在该值之后拼接 `uuid`，不能只传 `example`。
- 该模式只允许在已授权的测试环境使用，禁止指向生产 Redis。
- 种子 key 与后端校验一致，TTL 默认 120 秒，只能消费一次。
- `--print-token` 和登录证据包含有效会话信息；证据留在 `tmp/` 并限制访问，不粘贴到共享日志或提交到仓库。运行后按测试账号生命周期撤销会话。

## 6. 前端单测与界面测试

前端单测与界面测试是两条独立门禁，不能互相替代。

### 6.1 前置

从仓库根目录执行以下带工作区路径的命令。Node 必须为 `24.18.0`，pnpm 版本由根 `package.json` 的 `pnpm@10.34.1` 固定。纯单测、lint 与构建不需要启动 backend/dev server；浏览器 E2E 需要真实 MySQL/Redis、正确的测试账号与加密配置。

首次运行界面测试，或 Playwright 升级后，先安装 Chromium：

```bash
pnpm --dir skills/test-cli/scripts install
pnpm --dir skills/test-cli/scripts exec playwright install chromium
```

### 6.2 单元测试

```bash
pnpm --dir frontend-vue run test:unit
pnpm --dir frontend-vue run test:unit:coverage
pnpm --dir frontend-react run test
pnpm --dir frontend-react run test:coverage
```

### 6.3 界面测试

使用真实 backend、真实 MySQL/Redis、真实验证码登录和 Playwright Chromium：

```bash
node skills/test-cli/scripts/run_admin_e2e.mjs --client vue --route-limit 3
node skills/test-cli/scripts/run_admin_e2e.mjs --client react --route-limit 3
```

默认路由 smoke 会逐路由检查 `console.error` / `pageerror` 和截图证据。浏览器缺失、后端不可达、验证码种子写入失败必须显式失败，不能通过关闭 console 检查或伪造登录绕过。

### 6.4 lint 与生产构建

构建前执行编码门禁，并确认 `VITE_APP_ENCRYPT=true` 时构建进程可读取与后端对应的 `VITE_APP_RSA_PUBLIC_KEY`、`VITE_APP_RSA_PRIVATE_KEY`。不要在缺失密钥时通过关闭加密制造构建成功。

```bash
node tools/validate_utf8.mjs
pnpm --dir frontend-vue run lint:eslint
pnpm --dir frontend-vue run build:prod
pnpm --dir frontend-react run lint
pnpm --dir frontend-react run build:prod
```

### 6.5 当前自动化边界与交付证据

- `generate-case-matrix.mjs` 生成设计清单，不执行测试；默认更新 `docs/testing/`。审计预览用 `--output-dir tmp/test-cli/matrix-preview`，确认变更后才更新受管产物。`gaps.md` 只报告静态组件/菜单匹配缺口，不代表完整运行态覆盖率。
- `run_admin_e2e.mjs` 从实时菜单接口选取非参数化路由，支持 `--include-route`、`--exclude-route`、`--route-limit`；尚未读取 `case-matrix.json`，不会自动覆盖固定公开页、消息中心、浏览器登录表单和多角色权限矩阵。它通过 API 登录后注入 `Admin-Token`。
- `playwright_core.mjs` 检查导航 HTTP 状态、URL、可选可见文本和 console/pageerror，并采集截图；HTTP 失败不能通过，但 HTTP 200 返回的空白页或 401/404 页面 DOM 仍需业务可见内容断言和截图审阅。`networkidle` 超时会继续取证，不能仅依据 runner 退出码宣布页面完整验收。
- E2E 自管栈记录 backend/frontend 的 `state.json` 并清理 owned 进程；`--no-start-stack` 复用的服务由其所有者管理。通用 Playwright 状态在 `tmp/test-cli/browser/states/`，CRUD 浏览器状态在当前 run 的 `browser-state.json`，DevTools 子进程状态/日志在 `tmp/test-cli/browser/chrome-devtools-mcp/`。Playwright 通过 pipe 通信，状态的 `pid` 是 runner PID、`port=null`，不是 Chromium OS PID；以 awaited `browser.close()` 和 `browserClosed` 留存关闭证据。DevTools 记录真实子进程 PID 并核验 owned 进程树退出。
- 自管栈的 HTTP 就绪探针接受 2xx–4xx；它不能证明验证码、数据库与 Redis 真正可用，也不能确认已复用服务的 profile/身份。`VITE_APP_PROXY_TARGET` 若已设置会优先于 `--backend-port` 推导值；执行前必须把 API 登录地址、浏览器代理和目标实例核对为同一环境。`--keep-stack-after` 仅在验证及报告落盘均成功后保留栈；落盘失败或期间收到中断会撤销保留决定并关闭 owned 进程，清理错误与原始错误同时保留。
- React coverage 在 `vite.config.ts` 配置了 lines/functions/branches/statements 阈值；Vue `vitest.config.ts` 当前只生成 coverage 报告，未设置阈值。不能把 Vue coverage 命令成功描述为达到某个自动阈值。
- OAuth Provider、邮件收件链路、OSS、部署子路径和生产监控/灾备必须分别具备真实环境证据；单测、静态矩阵及路由 smoke 无法替代。当前两端 OAuth 绑定页面提交绝对 redirect，而后端只接受安全相对路径，是已确认的业务实现阻塞，不能宣称绑定流程已验收。

### 6.6 CRUD 与登录执行限制

以下区分当前 runner 已实现的门禁与仍需环境验收的条件：

- CRUD runner 只接受 `--profile local`，直接解析 `application-local.yml` 并依赖 PATH 中的 JDK 21 与 `~/.m2/repository` 的 MySQL Connector/J。它不识别运行后端的 env 覆盖；覆盖 URL 或复用服务时必须人工确认 API/UI/JDBC 同一实例。该命令没有 dry-run，不能为查目标而裸运行。
- CRUD 的 `verification` 对新增/编辑断言恰好一条 API 与 DB 活动记录、关键字段和主键一致，对删除断言两侧均零记录；client 编辑实际修改 `activeTimeout`。邀请码取消断言状态 `2`，分页清理按 `total` 遍历，异常响应或不完整分页显式失败。断言通过仅覆盖本次选中模块与具体字段，不能替代完整业务验收。
- DB 查询错误以 `db.error` 和 `rows=null` 保留；查询未执行、异常响应或任一模块失败时 `finalDbResidue=null`，显示未知。只有所有选中模块查询成功且无活动记录才计为零。审阅 `preflightDb`、`verification`、`cleanup.finalDb`、`cleanupErrors`，残留或无法核实都使 run 失败。
- 正常、普通异常及 SIGINT/SIGTERM/SIGHUP 都进入统一收口：取消当前工作，先以独立 30 秒预算尝试当前 run API cleanup/DB 核对，再停止 owned 栈并保存最终报告；主要失败和 cleanup 失败同时保留。Maven 构建、JDBC 子进程及就绪探针可取消。硬终止、掉电、凭据失效或清理超时仍须根据 `test-data.json` 人工恢复；不要依靠下一次运行清理前次数据。
- `captcha_login.mjs` 与 route smoke 中显式 `--username` / `--password` 只是优先账号，失败后仍会尝试候选列表。隔离测试必须显式配置 `--login-candidates` 或 `LOGIN_CANDIDATES` 为已授权测试账号集合，不能依赖脚本内置示例候选；重试可能产生登录失败记录或锁定账号。
- 登录脚本始终发送加密请求，`--rsa-public-key` 或 `RSA_PUBLIC_KEY` 必须与目标后端的请求解密私钥匹配。`admin-route-probe` 不透传该 flag，应通过 `RSA_PUBLIC_KEY` 环境变量配置。前端构建密钥另由 `VITE_APP_RSA_*` 提供，不能认为覆盖登录脚本就同时覆盖了前端。
- `--print-token` 会输出真实会话；截图、测试数据与报告还可能包含个人数据、验证码答案和生成的 fixture 凭据。证据限本地受控 `tmp/`，不得公开上传。登录及 E2E 的 `--run-id` 强制使用字母或数字开头、仅含字母/数字/点/下划线/连字符的简单 slug，最长 120 字符；登录 `--run-dir` 校验必须在仓库 `tmp/` 内。停止进程不等于撤销测试登录会话，需另行退出/撤销。

恢复步骤与禁止事项遵循第 2–4 节及 [数据运维](./DATA-OPS.md)。工具隔离回归 SOP 见 [CRUD 模式](../skills/test-cli/references/crud/crud-patterns.md)；本轮采用假 HTTP/Redis/浏览器与临时进程验证工具行为，未执行真实 Redis/数据库写入、浏览器 CRUD 或生产验收。后端 smoke 的请求超时、监听及脱敏门禁另见 [后端验证 SOP](../tools/verify/README.md)。
