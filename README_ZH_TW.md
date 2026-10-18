<div align="center">

<img src="assets/logo.png" width="120" alt="InfoQ-Scaffold-AI Logo" />

# InfoQ-Scaffold-AI

[![CI](https://github.com/LuckyKuang/infoq-scaffold-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/LuckyKuang/infoq-scaffold-ai/actions/workflows/ci.yml)
![Version](https://img.shields.io/badge/Version-3.0.0-f66a39)
![JDK](https://img.shields.io/badge/JDK-21-1677FF)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-4.1.1-6DB33F)
![Vue](https://img.shields.io/badge/Vue-3.5.35-42B883)
![React](https://img.shields.io/badge/React-19.2.7-61DAFB)
[![License](https://img.shields.io/badge/License-MIT-F7C948)](LICENSE)

**AI 協作全端工程腳手架**

[English](README.md) | [簡體中文](README_CN.md) | 繁體中文 | [日本語](README_JA.md)

</div>

<!-- readme-section:notice -->
## 重要提醒

本專案僅供技術學習、研究與測試使用。使用前請先於非生產環境完成充分測試、驗證
與安全評估，並依 MIT 授權條款使用、修改與散布。因使用本專案而產生的風險、資料
遺失或服務中斷，由使用者自行評估與承擔。

<!-- readme-section:overview -->
## 專案概述

`infoq-scaffold-ai` 將 AI 協作規則、可執行 skill、OpenSpec、應用程式碼、驗證
流程與交付證據集中於同一個儲存庫，並提供可執行的 Spring Boot 後端，以及 Vue、
React 兩套管理主控台。

任務計畫僅保留在本機：`docs/plan/` 與 `openspec/changes/` 均由 Git 忽略。
後續執行計畫繼續寫入 `docs/plan/`，目錄按需建立，由使用者手動清理。

目前保留三個工作區：

- `backend`：Spring Boot 4.1 多模組後端
- `frontend-vue`：Vue 3 + Element Plus 管理端
- `frontend-react`：React 19 + Ant Design 管理端

初始化資料庫使用凍結基線
[`sql/infoq_scaffold_3.0.0.sql`](sql/infoq_scaffold_3.0.0.sql)，後續結構或種子
資料變更只能透過 `sql/infoq_scaffold_update_YYYYMMDD.sql` 增量腳本承載。

<!-- readme-section:features -->
## 核心功能

- 以 JDK 21、MyBatis-Plus 與 Spring Security 為基線的 Spring Boot 4.1 後端
- 共用同一套後端 API 契約的雙管理主控台
- 分層的 [`AGENTS.md`](AGENTS.md)、`skills` 與 OpenSpec 交付流程
- 凍結 SQL 基線與依日期命名的增量腳本
- 以 Docker Compose 部署 MySQL、Redis、MinIO、後端與管理端閘道
- 跨平台 `deploy-cli`，涵蓋 Apple container、WSL2 Docker 與 Linux Docker smoke 檢查
- UTF-8、Maven、pnpm 與管理端 E2E 驗證入口

<!-- readme-section:quick-start -->
## 快速開始

登入前請先匯入 SQL 基線，並啟動 MySQL 8 與 Redis 7。

### 後端

```bash
node tools/backend_mvn.mjs -- clean install -DskipTests
java -jar backend/infoq-admin/target/infoq-admin.jar --spring.profiles.active=local
```

預設位址：`http://127.0.0.1:8080`。驗證碼介面：`http://127.0.0.1:8080/auth/code`。

### Vue 管理端

```bash
cd frontend-vue
pnpm install
pnpm run dev
```

### React 管理端

```bash
cd frontend-react
pnpm install
pnpm run dev
```

兩個管理端預設連接埠都是 `80`。同時啟動時，請先為其中一個設定
`VITE_APP_PORT`。各工作區範例分別從儲存庫根目錄執行，並先準備被忽略的後端 local
設定。`VITE_APP_ENCRYPT=true` 時須提供與後端匹配的 RSA 公私鑰環境變數，前置步驟請見
[`DEV_GUIDE.md`](DEV_GUIDE.md)。

使用 skill 執行管理端路由 smoke 或驗證碼登入：

```bash
# 驗證碼 E2E 會將種子答案寫入後端 Redis。
# 先設定 INFOQ_TEST_REDIS_HOST/PORT/DATABASE/PASSWORD（以及可選的 TLS）。
node skills/test-cli/scripts/run_admin_e2e.mjs --client vue --route-limit 1
node skills/test-cli/scripts/captcha_login.mjs --backend-url http://127.0.0.1:8080 --print-token

# 部署狀態：macOS 選擇 Apple，Linux/WSL2 選擇 Docker
node skills/deploy-cli/scripts/deploy_cli.mjs status
```

<!-- readme-section:deployment -->
## 部署方式

| 方式 | 文件 |
| --- | --- |
| Linux 安裝腳本 | [部署指南](deploy/README.md) |
| Docker Compose | [Docker 指南](deploy/DOCKER.md) |
| Apple container | [Apple container](deploy/APPLE_CONTAINER.md) |
| 部署生命週期 | [部署生命週期](deploy/DEPLOYMENT_LIFECYCLE.md) |
| Compose 環境範本 | [.env.example](deploy/.env.example) |
| 手動部署 | [手動部署](deploy/MANUAL.md) |
| 部署前置條件 | [部署前置條件](deploy/README.md) |

| 平台 | 完整堆疊 | 建議方式 |
| --- | --- | --- |
| Linux | 是 | Docker 安裝腳本 |
| Windows | 是 | WSL2 Debian/Ubuntu + Docker CE |
| macOS | 是 | Colima + Docker |
| macOS | 否，僅後端 | Apple container |
| macOS | 否，後端 + 管理端 dev server | Apple container + `pnpm run dev` |

映像在目標主機上從原始碼建置，儲存庫不發布預建應用程式映像：Docker 路徑會在
映像內建置後端 jar 與前端產物；Apple container 路徑會先在主機打包 jar，再啟動
僅包含 MySQL、Redis 與後端 API 的堆疊（不含 Vue/React 與 Nginx 閘道）。Release
產物是 jar 與管理端 `dist` 壓縮包，不是容器映像。

```bash
# Linux / WSL2：從已審閱的目標 release tag 原始碼部署
sudo env INFOQ_SOURCE_DIR="$(pwd)" INFOQ_FRONTEND_TARGET=all \
  INFOQ_PUBLIC_BASE_URL=http://SERVER_IP bash deploy/install.sh
```

`INFOQ_FRONTEND_TARGET` 為必填：`all`、`vue` 或 `react`。`all` 目標的 Nginx
路由：`/vue/`、`/react/`、`/console-oss/`、`/oss/`。

遠端安裝請依部署指南固定 tag，下載並審閱後再執行。macOS Colima 使用底層 shell
腳本；Node CLI 在 macOS 固定選擇 Apple，Apple `status` 可能啟動 daemon。生產前須
核驗獨立憑證、建置金鑰匹配、HTTPS、監控與已演練的備份/回滾；範例金鑰和建置成功
不足以證明生產就緒。

<!-- readme-section:documentation -->
## 文件

README 僅提供專案總覽與快速開始。詳細設定與維護請閱讀下列文件。

| 文件 | 說明 |
| --- | --- |
| [文件中心](docs/README.md) | 使用者文件導覽 |
| [文件稽核紀錄](docs/DOCUMENTATION-AUDIT.md) | 涵蓋範圍、修正、檢查與正式環境驗收阻礙 |
| [貢獻指南](CONTRIBUTING.md) | 工具鏈、驗證與 PR 流程 |
| [開發指南](DEV_GUIDE.md) | 本機設定與疑難排解 |
| [安全策略](SECURITY.md) | 漏洞回報 |
| [AGENTS.md](AGENTS.md) | 儲存庫協作規則 |
| [設計系統](docs/DESIGN.md) | 管理端視覺語言 |
| [發布流程](docs/RELEASING.md) | 版本、tag、Release workflow 與回滾 |
| [CI 驗證](docs/CI_VALIDATION.md) | 工作流涵蓋範圍、本機門檻與安全掃描 |

## 社群

歡迎在 [Linux DO](https://linux.do) 社群分享想法、討論 infoq-scaffold-ai。

<!-- readme-section:license -->
## 授權條款

[MIT License](LICENSE)
