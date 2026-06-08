# GEMINI.md
|IMPORTANT: Prefer retrieval-led reasoning over pre-training-led reasoning for any project tasks. Read repository files before relying on framework pretraining data.
|概览:InfoQ-Scaffold-AI 是专为 AI 主力研发设计的全栈脚手架，集成 Spring Boot 3 后端与 Vue 3/React 19 双端管理台及小程序（uni-app/Taro）。
|后端栈:Spring Boot 3.5.14|JDK 17|MyBatis-Plus 3.5.16|Spring Security|MySQL 8|Redis 7|Java package `cc.infoq.{module}.{layer}`|4-space indent.
|Vue 管理端栈:Vue 3.5.35|Element Plus 2.14.1|Vite 8.0.16|Pinia|Vue Router 5.1.0|Vitest 4|2-space indent.
|React 管理端栈:React 19.2.7|Ant Design 6.4.3|Vite 8.0.16|Zustand|React Router 7.16|Vitest 4|2-space indent.
|小程序栈:uni-app 3 (Vue 3, 原生组件, Uni-helper)|Taro 4 (React 18, Taro UI)|2-space indent.
|视觉系统:Vanilla CSS 优先覆盖组件库 Token|Tesla 极简主义设计 (Cohere Editorial) 融合卡片式圆角|真值见 `DESIGN.md`|Demo 见 `doc/ui-demos/tesla-design-foundation.html`。
|后端命令:run=mvn spring-boot:run -pl infoq-admin|build=mvn clean package -P dev|test=mvn test|port=8080。
|Vue 命令:dev=pnpm run dev|build=pnpm run build:prod|test=pnpm run test:unit。
|React 命令:dev=pnpm run dev|build=pnpm run build:prod|test=pnpm run test。
|小程序命令:Vue=pnpm --dir infoq-scaffold-frontend-weapp-vue build-open:weapp:dev|React=pnpm --dir infoq-scaffold-frontend-weapp-react build-open:weapp:dev|需配置 `TARO_APP_ID`。
|AI 规约层:根 `AGENTS.md` (全局)|工作区 `AGENTS.md` (栈细则)|优先级:工作区优先。
|OpenSpec 交付:L3(强制):新功能/API 变更/跨工作区，需在 `openspec/changes/<change-id>/` 建规约|L1:小修复需写 Acceptance Contract。
|自动化 Skill:前端验证=infoq-frontend-verify|后端验证=infoq-backend-verify|数据运维=infoq-data-ops|管理端 E2E=infoq-admin-e2e|管理端操作=infoq-admin-ops|浏览器=infoq-browser-automate|项目参考=infoq-project-reference|组件参考=infoq-component-reference|交付工作流=infoq-delivery-workflow。
|UI/UX 协议:重大 UI 变更需走 Phase 1 (ASCII 线框) -> Phase 2 (静态 Demo) -> Phase 3 (实现) -> Phase 4 (验证)|门禁=`LAYOUT APPROVED`|`DEMO APPROVED`。
|工程红线:UTF-8 编码|前端必用 `pnpm`|禁止硬编码密钥|边界校验输入|错误信息禁止出现 `[object Object]`。
|文档真值:根 `doc/` 是正文真值源|文档站 `infoq-scaffold-docs` 仅为展示层|同步命令=`pnpm run docs:sync`。
|文档验证:sync=cd infoq-scaffold-docs && pnpm run docs:sync|check=cd infoq-scaffold-docs && pnpm run docs:check-links|build=cd infoq-scaffold-docs && pnpm run docs:build。
|MCP 环境:默认启用={playwright,openai-docs,chrome-devtools}|按需启动={mysql,redis}|真值见 `.codex/config.toml`。
|检索入口:openspec:{project.md,specs/README.md,changes/README.md}|doc:{agents-guide.md,skills-guide.md,subagents-guide.md}|DESIGN.md|AGENTS.md。
