# Skills 收敛执行计划（11 → 8）

> 状态：已被 `skills-4-cli-restructure`（见 `docs/plan/2026-09-23-skills-4-cli-plan.md`）取代。
> 本文件保留 11 → 8 阶段的决策与证据，作为后续 8 → 4 收敛的历史输入；当前有效 skill 清单以根 `AGENTS.md` 与 `docs/SKILLS.md` 为准。

- 日期：2026-09-23
- Change：`skills-consolidation-11-to-8`（本地脚手架 `openspec/changes/`，不进 PR）
- 结论来源：对 `skills/` 11 个仓库级 skill 的完整审计（SKILL.md、agents/openai.yaml、references/scripts、跨仓引用、git 历史）

## 1. 判据

| 判据 | 含义 |
| --- | --- |
| 可执行入口 | 是否有 repo-owned Node CLI / MJS 入口，或由 MCP / `deploy/` 脚本承载真实执行路径 |
| 唯一职责 | 是否持有其他 skill 或 docs 未覆盖的领域门禁、脚本实现或运行时经验 |
| 触发语义 | 根 `AGENTS.md` 的 `Skill Priority` / `Skill Trigger` 是否与别的 skill 正面重叠 |
| 漂移成本 | 是否含版本号、快照式第三方信息或与大段全局规则重复，且无门禁能发现漂移 |

## 2. 判定结果

保留（8）：

| Skill | 保留理由 |
| --- | --- |
| `docs/DELIVERY-WORKFLOW.md` | `openspec_check.mjs` 是根 AGENTS 强制门禁；UI 四阶段与插件矩阵唯一持有者 |
| `tools/verify` | 8 处 skill 内跨引用；login / smoke / cluster 脚本唯一实现 |
| `infoq-test` | 单测 / coverage / lint / build / 本地栈唯一入口；`tools/lib/admin_dev_stack.mjs` 被 admin-e2e 复用 |
| `infoq-test` | 真实验证码 E2E、case matrix、CRUD、隔离在线强退唯一实现 |
| `docs/DATA-OPS.md` | SQL 冻结基线 / 增量脚本 / 只读 MCP 门禁唯一声明处 |
| `deploy/VERIFICATION.md` | WSL2 Docker CE、macOS Colima、Linux 部署与卸载验证唯一 SOP，含大量运行时经验 |
| `infoq-release` | 版本 bump 脚本与回归测试唯一实现 |
| `infoq-test` | 唯一通用浏览器执行器与 DevTools 诊断入口 |

合并 / 回收（3）：

| Skill | 处置 | 证据 |
| --- | --- | --- |
| `infoq-admin-ops` | 内容并入 `infoq-test/references/ops/page-ops-guardrails.md` | 零脚本零 references；写入门禁清单与 `docs/DATA-OPS.md` 逐条同构；Skill Trigger 与 admin-e2e 重叠 |
| `infoq-component-reference` | 内容并入 `docs/DESIGN.md` 组件选型章节 + 工作区 AGENTS | 快照日期 2026-03-12；antd 6.3.2 vs 实际 ^6.4.3、Element Plus 2.13.5 vs 实际 2.14.1；skills 内 0 跨引用 |
| `infoq-project-reference` | 内容回收到 `docs/ARCHITECTURE.md` 与 `docs/AI-COLLABORATION.md`，并解除 release-ops 受管耦合 | 与根 AGENTS / 工作区 AGENTS / ARCHITECTURE / DEV_GUIDE 重复；受 `bump_version.mjs`、`test_bump_version.mjs`、`targets.md` 三处硬依赖；`e8e5f46` 已修过一次漂移 |

## 3. 执行顺序

1. Phase A：admin-ops 合并（references/ops + 场景 + 护栏）。
2. Phase B：component-reference 合并（docs/DESIGN.md + 工作区 AGENTS/GEMINI）。
3. Phase C：project-reference 回收（docs/ARCHITECTURE.md、docs/AI-COLLABORATION.md）与 release-ops 解耦。
4. Phase D：路由与文档收口（根 AGENTS、docs/SKILLS.md、docs/AI-COLLABORATION.md）。
5. 验证：openspec_check → validate_utf8 → check_readme_sync → release-ops 回归 → 残留 grep → diff 审查。

## 4. 内容去向

| 原位置 | 去向 | 说明 |
| --- | --- | --- |
| `infoq-admin-ops` 场景 / 门禁 / 护栏 | `skills/infoq-test/references/ops/page-ops-guardrails.md` | 页面运维与权限巡检归入管理端领域 skill |
| `infoq-component-reference` 选型手册 | `docs/DESIGN.md` 组件选型章节 | 改为不写死版本的表述，版本以 lockfile 为准 |
| `infoq-project-reference` React 分包真值 | `docs/ARCHITECTURE.md` React 管理端章节 | 分包策略与 chunk 验收标准 |
| `infoq-project-reference` 工程标准与代码度量 | `docs/AI-COLLABORATION.md` 工程标准小节 | 与根 AGENTS 重复的条款去重，仅保留仓库内无落点的代码度量与解耦规则 |
| `infoq-project-reference` 目录 / 命令 / SQL / 交付清单 | 无需迁移 | 已由根 AGENTS、工作区 AGENTS、`docs/ARCHITECTURE.md`、`DEV_GUIDE.md`、`README.md`、`deploy/DOCKER.md` 覆盖 |

## 5. 顺带治理项

- `infoq-release` 的 `filesToCheck` 与 SQL 引用断言不再包含 skill 文档，版本升级不再修改 `skills/`。
- 根 `AGENTS.md` 的 Skill Trigger 删除 admin-ops / component-reference / project-reference 三项分派，减少路由歧义。

## 6. 延期范围

- `infoq-test` 的 `admin-route-probe` 迁入 `infoq-test`：现存在 `browser-automate → backend-verify/admin-e2e` 的反向依赖，且 admin 专属流程放在通用执行器中语义错位。本轮不动，登记为下一轮候选。

## 7. 验证命令

```bash
node tools/openspec_check.mjs skills-consolidation-11-to-8
node tools/validate_utf8.mjs
node tools/check_readme_sync.mjs
node skills/infoq-release/scripts/test_bump_version.mjs
node skills/infoq-release/scripts/bump_version.mjs --dry-run 3.0.0
git grep -n 'infoq-admin-ops\|infoq-component-reference\|infoq-project-reference'
git diff --check
```
