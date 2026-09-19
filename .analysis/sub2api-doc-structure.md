# Sub2API 文档结构分析

## 核心特点

### 1. 多语言支持
- `README.md` (English)
- `README_CN.md` (中文)
- `README_JA.md` (日本語)
- 使用 section markers 保持结构对齐: `<!-- readme-section:xxx -->`

### 2. 文档分层清晰

#### 根目录核心文档
- `README.md` - 项目概述、快速开始、功能特性
- `AGENTS.md` - 强制性规则，压缩格式（管道分隔）
- `CONTRIBUTING.md` - 贡献指南、工具链、验证流程
- `DEV_GUIDE.md` - 开发设置、故障排除
- `SECURITY.md` - 安全策略、漏洞报告
- `UPSTREAM.md` - 上游映射关系
- `release-notes.md` - 发布说明

#### docs/ 目录（详细文档）
```
docs/
├── README.md                    # 文档索引
├── providers/                   # 供应商文档
│   ├── GROK.md
│   ├── SORA.md
│   ├── ANTIGRAVITY.md
│   └── ...
├── protocols/                   # 协议文档
│   ├── OPENAI_RESPONSES.md
│   └── CODEX_CLIENT_PROFILES.md
└── [其他主题文档]
```

#### deploy/ 目录（部署文档）
```
deploy/
├── README.md                    # 部署指南主入口
├── DOCKER.md                    # Docker 部署
├── APPLE_CONTAINER.md          # macOS 容器部署
├── EDGE_SECURITY.md            # 边缘安全配置
├── config.example.yaml         # 完整配置示例
├── docker-compose.yml          # 生产编排
├── docker-compose.dev.yml      # 开发编排
├── install.sh                  # Linux 安装脚本
└── ...
```

### 3. AGENTS.md 规则格式

使用**管道分隔的压缩格式**，每行一条规则：
```
|Rule:Description|Details|Examples or constraints
```

特点：
- 简洁、可扫描
- 强制性规则集合
- 引用其他文档作为 sources of truth
- 不重复详细版本号和命令

### 4. README 结构模式

#### Section Markers（保持多语言对齐）
```markdown
<!-- readme-section:notice -->
## Important Notice

<!-- readme-section:overview -->
## Overview

<!-- readme-section:features -->
## Features

<!-- readme-section:quick-start -->
## Quick Start

<!-- readme-section:deployment -->
## Deployment Options

<!-- readme-section:documentation -->
## Documentation
```

#### 特征
- Logo 居中显示
- 徽章行：CI、License、版本等
- 语言切换链接
- 表格化的部署选项
- 简洁的文档索引

### 5. CONTRIBUTING.md 结构

1. **Toolchain** - 工具链声明（引用源文件）
2. **Development Checks** - 验证容器要求
3. **命令列表** - 按前后端分类
4. **Generated Code** - 代码生成规范
5. **Database Changes** - 数据库迁移规范
6. **Documentation and Localization** - 文档和国际化
7. **Pull Requests** - PR 规范

### 6. 部署文档组织

- 每种部署方式独立文档
- `deploy/README.md` 作为统一入口
- 配置示例文件与文档并列
- 包含安装脚本和服务文件

### 7. 文档写作风格

- **简洁直接**：不啰嗦，直击要点
- **引用源头**：版本号、命令等引用源文件，不重复
- **结构化**：使用表格、列表、代码块
- **可操作**：每个指南都有明确的命令
- **维护性**：减少重复，通过引用保持一致性

## 对 infoq-scaffold-ai 的启示

### 需要改进的地方

1. **缺少多语言版本** - 只有英文 README
2. **文档分散** - 没有统一索引
3. **AGENTS.md 冗长** - 可以用压缩格式
4. **缺少 CONTRIBUTING.md** - 贡献流程不明确
5. **缺少 DEV_GUIDE.md** - 开发设置分散
6. **缺少 SECURITY.md** - 安全策略未明确
7. **deploy/ 目录混乱** - 部署文档和脚本混在 doc/ 下
8. **版本信息分散** - 需要统一更新到 3.0.0

### 改造优先级

1. ✅ 更新所有版本信息 (3.0.0, Spring Boot 4.1.1, JDK 21)
2. 🔄 重构 README.md（添加 section markers）
3. 创建 README_CN.md（中文版）
4. 重构 AGENTS.md（压缩格式）
5. 创建 CONTRIBUTING.md
6. 创建 DEV_GUIDE.md
7. 创建 SECURITY.md
8. 重组 docs/ 目录（创建索引）
9. 重组 deploy/ 目录
10. 更新后端 AGENTS.md

### 保留的优势

- ✅ 已有 OpenSpec 支持
- ✅ 已有 .codex/skills 结构
- ✅ 已有详细的架构文档
- ✅ 已有完整的验证脚本

## 实施计划

按照任务列表系统地改造，确保：
- 保持现有文档的准确性
- 提升可维护性
- 改善用户体验
- 对齐 sub2api 的最佳实践
