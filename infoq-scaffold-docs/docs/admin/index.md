---
title: 管理端
description: Vue / React / React Pro 管理端的共通机制、路由装载和页面扩展方式。
---

# 管理端

本项目同时维护 Vue 3 + Element Plus、React 19 + Ant Design 和 React 19 + Ant Design Pro 三套管理端。正文重点是“共享了什么”和“各自如何实现”，而不是把三边写成互不相关的产品文档。

系统监控能力现已包含在线用户、日志、任务调度、缓存、服务监控和 Hikari 原生连接池监控，其中连接池监控页面只展示安全摘要字段，不暴露 JDBC URL、账号与连接池实现细节。

<div class="iq-page-grid">
  <a class="iq-link-card" href="/admin/handbook">
    <strong>管理端手册</strong>
    <p>查看登录、动态菜单、请求封装、固定路由、页面目录和常见踩坑点。</p>
  </a>
</div>
