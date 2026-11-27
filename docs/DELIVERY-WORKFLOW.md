> 来源说明：本文件承接交付工作流治理规则，覆盖 Acceptance Contract、OpenSpec 门禁、UI 四阶段、插件治理计划、单测纪律与全仓审计 SOP。

# InfoQ 交付工作流

本文件负责两件事：为高影响或跨工作区变更建立可验证的交付流程，并保存交付期的单测纪律与全仓审计 SOP。

## 场景选择

1. 新功能、API 契约变更、跨工作区交付或用户明确要求 OpenSpec 时，走 OpenSpec。
2. 单工作区但影响用户可见行为且范围不小的改动，可走 OpenSpec Lite。
3. 重大 UI/UX、布局审批、`LAYOUT APPROVED` 或 `DEMO APPROVED` 门禁，读取 `docs/UI-WORKFLOW.md`，并按四阶段执行。
4. 插件新增、插件开关化、插件治理或插件分类判断，读取 `docs/SKILLS.md` 第 9 节插件矩阵，必要时运行插件计划脚本。
5. 生产或共享环境数据变更、SQL 迁移、批量修复、权限/菜单/任务基础数据调整，必须联动 `docs/DATA-OPS.md`；不确定分级时按 OpenSpec Lite 或 L3。
6. L1 小修复可不建 OpenSpec，但实现前必须写清 Acceptance Contract。
7. 本机部署、Apple container 启停、WSL2/Linux Docker 启停与容器 smoke，使用 `deploy-cli` 并读取 `deploy/DEPLOYMENT_LIFECYCLE.md`。
8. Linux Docker 生产修复须分别记录仓库回归与目标环境结果；预检使用 `tools/production_config.mjs`，隔离备份恢复、回滚、告警与容量使用 `tools/verify/`。缺 daemon、受控凭据、告警接收证据或容量/RTO/RPO 目标时保持明确阻塞，继续完成可独立验证的代码与 SOP。

## 默认命令

初始化 active change：

```bash
node tools/init_change_dir.mjs <change-id>
```

校验 active change：

```bash
node tools/openspec_check.mjs <change-id>
```

生成插件接入计划：

```bash
node tools/generate_plugin_plan.mjs --name infoq-plugin-xxx --class toggle --frontend auto
```

## Acceptance Contract

字段清单以根 `AGENTS.md` 的 `Acceptance Contract` 为准，定义位置是当前任务上下文或 `proposal.md`。任一项缺失或冲突时，先暴露问题再编码。

## 验证顺序

验证顺序固定为根 `AGENTS.md` 的 `Execution Loop`；active change 的 OpenSpec 结构校验必须在实现前和交付前通过，但不代替该闭环。

交付前显式检查性能影响、日志/告警覆盖、回滚路径，以及 config/SQL/依赖影响。任何未执行或无法执行的必要检查必须记录为阻塞或残余风险；文档核对不能替代生产环境运行验收。

## 单测纪律

- 按业务行为与边界条件编写，不为覆盖率凑数；断言必须能因真实缺陷而失败。
- 单测失败先检查并修复产品代码；只有需求或断言本身错误且给出证据时，才允许改测试。
- 禁止为通过而削弱断言、放宽 mock、压警告、抬阈值或伪造成功路径。
- 每类单测先跑通一个最小闭环，再把可复用 SOP 沉淀到既有 skill 的 `references/`，或 `tools/`、`docs/` 资产；不因此新增 skill。
- 需要真实生产配置的测试与完整业务单测分开运行，分组命令见 `docs/CI_VALIDATION.md`；prod 少量配置测试不能替代完整 dev 业务单测。

## 全仓审计与回归 SOP

触发条件：全仓审计，或规则、skill、命令参数、环境前置条件、发布/部署入口发生变化。

1. 写唯一 acceptance contract，保留当前 diff；独立发现维护中的 Markdown 与操作/config 入口，包含隐藏目录和未被文档引用的入口，记录排除理由。
2. 每份文档追溯到当前解析器、package/POM、env/config 与源码，核对默认值、前置条件、读写副作用、日志、失败与恢复；根规约结构检查后仍需人工语义审查，近层规约分别核查。
3. 按最小问题类别修复。连接解析用合成 YAML；进程生命周期用自有父/孙进程与同组无关进程；浏览器用可控制关闭/中断的替身；CRUD 用 API/DB 正反数据、精确键与查询失败。测试断言状态、退出码与副作用，不只检查源码字符串。
4. 远程 CLI 用本地 bare origin 与 gh 替身，核目标绑定、预览、鉴权、保护、参数冲突与资产；部署用命令替身和隔离目录，覆盖权限、渲染错误、归属不符、daemon 故障与升级边界，不触达真实栈。
5. 按主流程验证 → 定向回归 → 编码/语法/结构等价检查 → 人工 diff 的顺序验收。新反例先复现再修根因，不弱化断言；每类 SOP 沉淀到既有 skill `references/` 或 `tools/`、`docs/`。
6. 重新发现新增/删除文件，核对最终 hash、唯一负责人与状态。清单缺项、重复、未核验或门禁失败阻止交付；复审必须使用本轮证据，不能复用上轮通过结论。
7. 独立复核最终差异与耐久报告，区分已修、实现阻塞与环境未验证；记录性能、可观测性、回滚与 config/SQL/依赖影响，写明实际边界。

反模式：整批执行代码块、把查询异常记成空集合、把发出 kill 当作退出、将 daemon 失败当资源不存在、把 readonly 开关当服务端 ACL、用旧演练或示例凭据证明生产达标、用链接/语法通过代替操作语义。

## 参考

- OpenSpec 工作流：`docs/OPENSPEC-WORKFLOW.md`
- UI/UX 设计辅助层：`docs/UI-WORKFLOW.md`
- 插件治理矩阵：`docs/SKILLS.md` 第 9 节
- 部署生命周期：`deploy/DEPLOYMENT_LIFECYCLE.md`
- OpenSpec 长期项目上下文：`openspec/config.yaml`（context 段）
- 当前规格真值：`docs/specs/`
