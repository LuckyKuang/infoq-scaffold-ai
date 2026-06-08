# OpenSpec 活跃变更目录

活跃工作统一放在 `openspec/changes/<change-id>/`。

## 推荐目录结构

```text
openspec/changes/<change-id>/
├── proposal.md
├── design.md            # 可选
├── tasks.md
├── materials.md         # 可选
├── review.md            # 可选：归档受阻或需要书面审计记录时使用
└── specs/
    └── <capability>/spec.md
```

## 编写规则

- `proposal.md` 应包含背景、问题陈述、目标与成功指标、变更内容、验收约定、延期范围与风险说明
- `design.md` 仅在用户体验或技术权衡需要长期决策记录时必填
- `tasks.md` 是执行清单与验证真值来源，必须显式覆盖统一影响矩阵与验证映射
- `materials.md` 为可选项，仅在文案/模拟数据/图标指引确有价值时编写
- `review.md` 为可选项，仅在审计受阻或需要明确书面验收总结时编写
- 规范增量放在当前变更目录下的 `specs/`
- repo-level 或高风险治理变更，应额外在 `doc/plan/` 中保留执行计划
- `openspec/changes/` 下的 active change 属于真值资产，不使用 `.gitignore` 做整体排除
- 临时 smoke/change 目录若只用于一次性验证，验证后应显式删除；不要长期留在 `openspec/changes/`
- 实现前和交付前都必须执行：

```bash
node .codex/skills/infoq-delivery-workflow/scripts/openspec_check.mjs <change-id>
```

- 只有在验证证据完整后才允许归档或合并
- OpenSpec 文档正文默认中文；路径名称、命令、文件名保持英文

## 当前状态

- 当前不再保留仓库内 demo change 样例，新的示例应优先通过 `init_change_dir.mjs` 生成，并按当前模板与 `openspec-check` 维护
- 当前也不保留空的 `archive/` 占位目录；当首次需要归档已接受变更时再按需创建
