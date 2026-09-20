---
name: infoq-project-reference
description: 加载本仓库的静态项目参考信息，包括工作区布局、关键入口与配置路径、架构与命名规则、UTF-8 与包管理约定、构建/运行/测试/部署命令、分支与 PR 预期、以及工程/安全/验证标准。当用户询问项目结构、启动/构建/测试/部署流程、配置或入口文件、编码规范、质量规则、安全基线、测试策略，或任务需要仓库专属参考上下文且不应放入常驻 AGENTS 内存时使用。
---

# InfoQ 项目参考

当任务需要稳定且有用的仓库参考资料，但又不需要每轮都常驻在 AGENTS 中时，使用此技能。

## 工作流程

1. 阅读 `references/project-reference.md`，获取仓库结构、命令与交付约定。
2. 当任务涉及 React admin 构建、chunk warning、Vite/Rollup `manualChunks` 或前端分包优化时，优先读取其中的 React Admin 段落，并以 `infoq-scaffold-frontend-react/vite.config.ts` 当前实现为真值。
3. 当任务涉及编码规范、安全规则、测试策略、代码度量或实现质量时，阅读 `references/engineering-standards.md`。
4. 先检查更近的工作区 `AGENTS.md` 是否已回答问题；在使用全仓指导前，优先 backend/Vue/React 就近指令文件。
5. 仅加载与当前任务相关的章节，不要把整份参考文档全部塞入上下文。
6. 将参考文件与命令视为线索，在改动前先核验仓库当前状态。
7. 高优先级全局规则应留在 `AGENTS.md`；不要把 retrieval-first、AI 编码护栏、UTF-8、显式失败策略等通用规则移出 AGENTS。

## 典型触发场景

- 用户询问项目模块、入口文件、配置文件、基础设施文件或 SQL 文件所在位置。
- 用户询问如何构建、运行、测试、部署或验证本仓库。
- 用户要处理 React admin 的构建告警、chunk 拆分、入口包体、`manualChunks` 或路由级代码分割。
- 任务依赖包命名、分层、缩进、编码、提交规则、分支命名或 PR 预期。
- 任务需要工程基线（如代码度量、依赖注入、不可变性、安全边界、显式失败规则、后端单测超时策略）。
- 任务需要仓库参考上下文，但不值得扩张顶层 AGENTS，且更近的工作区 AGENTS 未提供答案。

## 参考

请阅读：

- `references/project-reference.md`
- `references/engineering-standards.md`
