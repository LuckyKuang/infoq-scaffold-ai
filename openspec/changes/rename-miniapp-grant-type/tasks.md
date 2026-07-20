# Tasks: rename-miniapp-grant-type

## 交付概览

- [x] 明确本次 change 的主交付物与退出条件：新功能直接使用 `miniapp`，不兼容 `xcx`；消息接收人索引采用直接 DDL，重复索引错误由执行方处理。

## 影响矩阵

- [x] infoq-scaffold-backend：已替换认证常量、策略 Bean、设备枚举及关联单元测试和登录说明。
- [x] infoq-scaffold-frontend-react：不受影响；管理端不发起微信小程序授权。
- [x] infoq-scaffold-frontend-react-pro：不受影响；管理端不发起微信小程序授权。
- [x] infoq-scaffold-frontend-vue：不受影响；管理端不发起微信小程序授权。
- [x] infoq-scaffold-frontend-weapp-react：已替换登录请求、客户端/设备请求头、断言与说明文档。
- [x] infoq-scaffold-frontend-weapp-vue：已替换登录请求、客户端/设备请求头、断言与说明文档。
- [x] infoq-scaffold-docs：不受影响；文档站没有该授权类型的业务引用。
- [x] script / deploy：不受影响；部署配置不含 grant type 值。
- [x] sql：在未发布的新功能脚本中按稳定 `client_id` 直接写入 `miniapp` 客户端标识、授权类型及小程序授权/设备字典值。

## 实施任务

### 规格与方案

- [x] 完成 `proposal.md`、`tasks.md` 与必要 spec delta
- [x] 无重大技术或 UI 决策；无需 `design.md`

### 实现

- [x] 按影响矩阵逐项实现或显式记录“不受影响原因”

## 验证映射

### 主流程验证

- [x] 精确检索确认生产代码、SQL 和文档均使用 `miniapp` 客户端标识；`xcx` 和 `weapp` 客户端值仅保留在冻结基线及同一新功能脚本的初始化条件中，运行时平台标识 `weapp` 保持不变。

### 定向测试

- [ ] 后端：`node .codex/scripts/backend_mvn.mjs -- -f infoq-scaffold-backend/pom.xml -pl infoq-modules/infoq-system -am test` 被环境阻塞：未检测到 JDK 17，Maven 未启动。
- [x] React weapp：`pnpm --dir infoq-scaffold-frontend-weapp-react run test` 通过，16 个文件、110 项测试。
- [x] Vue weapp：`pnpm --dir infoq-scaffold-frontend-weapp-vue run test` 通过，19 个文件、130 项测试。

### lint / build

- [ ] 后端：定向 Maven 编译由测试命令覆盖，但同样被缺失 JDK 17 阻塞。
- [x] React weapp：`pnpm --dir infoq-scaffold-frontend-weapp-react run lint` 与 `pnpm --dir infoq-scaffold-frontend-weapp-react run build:weapp:dev` 通过。
- [x] Vue weapp：`pnpm --dir infoq-scaffold-frontend-weapp-vue run typecheck` 与 `pnpm --dir infoq-scaffold-frontend-weapp-vue run build:weapp:dev` 通过。
- [x] 根目录：`node .codex/scripts/validate_utf8.mjs` 通过。

### 差异审查

- [x] 审核 diff、计划文件、active change 和 stable specs 是否一致；`.gitignore` 仅显式放行本次 active change，避免暴露无关的历史目录。

## 延期范围

- [x] 无；若本轮显式延期，请在此记录

## 阻塞与残余风险

- [x] 后端定向测试和 Maven 编译未执行，因为环境未提供 JDK 17。前端命令均在 Node 22.20.0 下通过，但仓库基线要求 Node 24.18.0，因此仍需在标准 Node 版本的 CI 或开发环境复验。
