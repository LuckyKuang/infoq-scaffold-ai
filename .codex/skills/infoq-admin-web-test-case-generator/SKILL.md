---
name: infoq-admin-web-test-case-generator
description: 生成和校验本仓库 React/Vue 管理端 Web 自动化测试矩阵。适用于需要从后端 `sys_menu`、React `src/pages`、Vue `src/views`、路由资料和现有测试中整理 P0/P1/P2 用例、生成 `doc/test/frontend-web-automation/*` 报告或发现管理端自动化缺口的场景。
---

# InfoQ 管理端测试矩阵生成

本技能只负责一件事：生成或校验 React/Vue 管理端 Web 自动化测试矩阵。

## 默认命令

生成矩阵：

```bash
node .codex/skills/infoq-admin-web-test-case-generator/scripts/generate-case-matrix.mjs
```

校验矩阵：

```bash
node .codex/skills/infoq-admin-web-test-case-generator/scripts/validate-case-matrix.mjs doc/test/frontend-web-automation/case-matrix.json
```

## 产物

默认输出到：

```text
doc/test/frontend-web-automation/
  case-matrix.md
  case-matrix.json
  gaps.md
```

## 工作流

1. 读取 `sql/infoq_scaffold_2.0.0.sql` 与 `sql/infoq_scaffold_update_*.sql` 中的 `sys_menu`。
2. 扫描 React `src/pages` 与 Vue `src/views`。
3. 扫描两端 `tests/`，用于标记已有测试线索。
4. 从菜单页、权限按钮和固定公开路由生成测试矩阵。
5. 输出 React/Vue 页面缺失、页面未挂菜单、隐藏路由和测试缺口。
6. 运行 `validate-case-matrix.mjs` 校验字段、ID、优先级和客户端范围。

## 关键参数

- `--output-dir <dir>`：覆盖默认输出目录。
- `--json <path>`：覆盖 `case-matrix.json` 输出路径。
- `--markdown <path>`：覆盖 `case-matrix.md` 输出路径。
- `--gaps <path>`：覆盖 `gaps.md` 输出路径。
- `--quiet`：只输出摘要。
- `--help`：显示帮助。

## 参考

- Schema：`references/case-schema.md`
- 模块分类：`references/module-taxonomy.md`
- 路由来源规则：`references/route-source-rules.md`

## 护栏

- 后端菜单是可访问功能的主要来源；前端目录只作为组件存在性校验。
- 脚本不启动浏览器、不登录、不写业务数据。
- 缺失映射必须写入 `gaps.md`，不得静默忽略。
- 生成矩阵后必须运行 `validate-case-matrix.mjs`。
