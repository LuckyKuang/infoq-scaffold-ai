---
layout: home
title: InfoQ Docs
titleTemplate: false
hero:
  name: InfoQ Docs
  text: 工程文档站，展示层独立，正文真值仍在仓库根 doc/
  tagline: 先把快速开始、工作区边界和部署链路做成清晰入口，再把 AGENTS、OpenSpec、skills 和 MCP 组织进可长期维护的站点结构里。
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/quick-start
    - theme: alt
      text: 文档索引
      link: /guide/documentation-index
    - theme: alt
      text: GitHub 仓库
      link: https://github.com/luckykuang/infoq-scaffold-ai
---

<div class="iq-editorial-card" style="margin-top: 40px; margin-bottom: 24px;">
  <h2>站点职责边界</h2>
  <p><code>infoq-scaffold-docs</code> 只负责导航、主题、构建、同步和部署；正文真值继续保留在仓库根 <code>doc/</code>。站点内容由同步脚本从根文档生成，避免双份手工维护。</p>
</div>

<div class="iq-editorial-card">
  <h2>近期能力更新</h2>
  <p>系统监控现已补齐 <strong>服务监控</strong> 与 <strong>Hikari 原生连接池监控</strong>。连接池监控当前只展示安全摘要指标，不再暴露 JDBC URL、账号和实现细节；对应正文说明已经同步到项目概览、后端手册和管理端手册。</p>
</div>

<div class="iq-highlight iq-editorial-card">
  <h2>推荐阅读路径</h2>
  <p>第一次接手仓库：项目概览 -> 快速开始 -> 后端 / 管理端 / 小程序正文手册 -> FAQ。</p>
  <div class="iq-step-grid">
    <div class="iq-step">
      <strong>1. 准备环境</strong>
      <p>确认 JDK 17、Maven、Node、pnpm、MySQL、Redis 以及需要时的 WeChat DevTools。</p>
    </div>
    <div class="iq-step">
      <strong>2. 跑主链路</strong>
      <p>先通后端和验证码接口，再起 Vue / React / React Pro 管理端，最后再处理小程序和部署链路。</p>
    </div>
    <div class="iq-step">
      <strong>3. 进入协作闭环</strong>
      <p>按 AGENTS / OpenSpec / skills / MCP 的约束推进变更，并执行对应工作区的最小验证。</p>
    </div>
  </div>
</div>

## 工作区入口

<div class="iq-page-grid">
  <a class="iq-link-card" href="/backend/">
    <strong>后端</strong>
    <p>Spring Boot 多模块结构、认证与菜单权限、插件开关、运行与调试入口。</p>
  </a>
  <a class="iq-link-card" href="/admin/">
    <strong>管理端</strong>
    <p>Vue / React / React Pro 三管理端共通机制、动态菜单、请求封装与页面扩展方式。</p>
  </a>
  <a class="iq-link-card" href="/weapp/">
    <strong>小程序</strong>
    <p>Vue / React 小程序端的环境变量、AppID、域名、构建和 DevTools 打开流程。</p>
  </a>
  <a class="iq-link-card" href="/devops/">
    <strong>部署运维</strong>
    <p>部署前准备、Docker Compose 部署、手动部署与运维交付物。</p>
  </a>
</div>

## 平台治理入口

<div class="iq-page-grid">
  <a class="iq-link-card" href="/collaboration/development-workflow">
    <strong>研发协作与工作流</strong>
    <p>从 acceptance contract、OpenSpec 到验证顺序的日常协作真值。</p>
  </a>
  <a class="iq-link-card" href="/collaboration/mcp-servers">
    <strong>MCP Servers</strong>
    <p>项目级 MCP 的启用状态、只读边界、审批模式和使用场景。</p>
  </a>
</div>
