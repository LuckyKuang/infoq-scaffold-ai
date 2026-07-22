# AGENTS.md
|Scope:适用于 `infoq-scaffold-docs/` 目录及其子目录。
|Encoding:所有文件保持 UTF-8。
|Package Manager:使用 `pnpm`。
|Environment Baseline:Node 24.18.0|pnpm >= 10.0.0|packageManager pnpm@10.34.1
|Stack:当前工作区是 `VitePress` 文档站展示层，不是业务前端工作区。
|Content Truth:根 `doc/` 是文档正文真值源。除站点首页、栏目页、主题配置、脚本和导航配置外，不要在本工作区手工维护第二份正文。
|Sync Rule:正文改动优先修改根 `doc/`，再运行 `pnpm run docs:sync` 更新站点内容。
|Allowed Direct Edits:`README.md`、`doc/**`、`docs/index.md`、`docs/*/index.md`、`docs/.vitepress/**`、`scripts/**`、`site-map.mjs`、`package.json`。
|Guardrails:不要把站点展示层实现反向变成新的内容真值源。不要为通过构建而删除根 `doc/` 中的真实引用关系；优先在同步脚本中显式重写链接与资源路径。
|Verification:本工作区默认验证顺序为 `pnpm run docs:sync -> pnpm run docs:check-links -> pnpm run docs:build`；涉及运行态页面时补充浏览器验证。
|Doc Entrypoints:`README.md`|`doc/architecture.md`|`doc/data-flow.md`|`scripts/README.md`
|Doc Sync Rule:站点导航、栏目映射、同步脚本、link checker、VitePress 主题或构建链路变更时，先更新离代码最近的 `scripts/README.md` 或 `doc/*.md`，再同步 `README.md` 与本文件；根 `doc/` 继续是正文真值。
