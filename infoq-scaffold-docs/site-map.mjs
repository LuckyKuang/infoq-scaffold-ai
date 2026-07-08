export const repoUrl = 'https://github.com/luckykuang/infoq-scaffold-ai';
export const repoBlobBase = `${repoUrl}/blob/main`;
export const sourceDocRoot = 'doc';

const makeRouteFromTarget = (target) => {
  const withoutExt = target.replace(/\.md$/u, '');
  if (withoutExt === 'index') {
    return '/';
  }
  if (withoutExt.endsWith('/index')) {
    return `/${withoutExt.slice(0, -'/index'.length)}/`;
  }
  return `/${withoutExt}`;
};

const defineSection = (key, text, description, pages) => ({
  key,
  text,
  description,
  pages
});

export const sections = [
  defineSection('guide', '入门', '项目定位、快速开始和常见问题。', [
    {
      source: 'README.md',
      target: 'guide/documentation-index.md',
      title: '文档中心索引',
      description: '仓库内 doc/ 目录的总入口和阅读路径。'
    },
    {
      source: 'guide/project-overview.md',
      target: 'guide/project-overview.md',
      title: '项目概览',
      description: '项目定位、工作区职责、技术栈与能力地图。'
    },
    {
      source: 'guide/quick-start.md',
      target: 'guide/quick-start.md',
      title: '快速开始',
      description: '环境准备、本地启动和最小验证闭环。'
    },
    {
      source: 'guide/faq.md',
      target: 'guide/faq.md',
      title: '常见问题',
      description: '运行、部署、登录和联调场景的常见排障入口。'
    }
  ]),
  defineSection('backend', '后端', 'Spring Boot 多模块后端结构与运行说明。', [
    {
      source: 'backend/handbook.md',
      target: 'backend/handbook.md',
      title: '后端手册',
      description: '配置、认证、菜单权限、插件与调试建议。'
    }
  ]),
  defineSection('admin', '管理端', 'Vue / React / React Pro 管理端的路由、请求封装和页面扩展方式。', [
    {
      source: 'admin/handbook.md',
      target: 'admin/handbook.md',
      title: '管理端手册',
      description: '三套管理端的共通机制与栈内差异。'
    }
  ]),
  defineSection('weapp', '小程序', 'Vue / React 小程序端的构建、环境变量和 DevTools 打开流程。', [
    {
      source: 'weapp/handbook.md',
      target: 'weapp/handbook.md',
      title: '小程序手册',
      description: '移动端请求封装、AppID、域名与 e2e 入口。'
    }
  ]),
  defineSection('devops', '部署运维', '部署前检查、Compose 部署与手动部署说明。', [
    {
      source: 'devops/deploy-prerequisites.md',
      target: 'devops/deploy-prerequisites.md',
      title: '项目部署前准备',
      description: '软件、端口、目录、配置和产物检查项。'
    },
    {
      source: 'devops/docker-compose-tutorial.md',
      target: 'devops/docker-compose-tutorial.md',
      title: 'Docker Compose 部署教程',
      description: '覆盖 WSL2 Docker CE、macOS Colima、Linux Docker CE 的完整部署教程。'
    },
    {
      source: 'devops/docker-compose-deploy.md',
      target: 'devops/docker-compose-deploy.md',
      title: 'Docker Compose 部署',
      description: '当前仓库真实可执行的脚本化部署入口。'
    },
    {
      source: 'devops/manual-deploy.md',
      target: 'devops/manual-deploy.md',
      title: '手动部署说明',
      description: '不依赖 Docker 的 jar + 静态资源部署方案。'
    }
  ]),
  defineSection('collaboration', '协作规范', 'AGENTS、OpenSpec、skills、MCP 和文档治理说明。', [
    {
      source: 'collaboration/development-workflow.md',
      target: 'collaboration/development-workflow.md',
      title: '研发协作与工作流',
      description: '从 acceptance contract 到验证闭环的日常流程。'
    },
    {
      source: 'collaboration/agents-guide.md',
      target: 'collaboration/agents-guide.md',
      title: 'AGENTS 指南',
      description: '仓库内 AGENTS 分层规则。'
    },
    {
      source: 'collaboration/skills-guide.md',
      target: 'collaboration/skills-guide.md',
      title: 'Skills 指南',
      description: '仓库级 skills 的职责与使用方式。'
    },
    {
      source: 'collaboration/subagents-guide.md',
      target: 'collaboration/subagents-guide.md',
      title: 'Subagents 指南',
      description: '多专家执行链路与角色边界。'
    },
    {
      source: 'collaboration/mcp-servers.md',
      target: 'collaboration/mcp-servers.md',
      title: 'MCP Servers',
      description: '项目级 MCP server 配置真值与审批策略。'
    },
    {
      source: 'collaboration/plugin-catalog.md',
      target: 'collaboration/plugin-catalog.md',
      title: '插件目录与开关策略',
      description: '插件分档、软开关矩阵与依赖策略。'
    },
    {
      source: 'collaboration/module-doc-governance.md',
      target: 'collaboration/module-doc-governance.md',
      title: '模块文档治理',
      description: '根文档、工作区总览、近代码文档与 AGENTS 路由的分层治理规则。'
    }
  ])
];

export const generatedPages = sections.flatMap((section) =>
  section.pages.map((page) => ({
    ...page,
    sectionKey: section.key,
    sectionText: section.text,
    route: makeRouteFromTarget(page.target)
  }))
);

export const generatedPageBySource = new Map(generatedPages.map((page) => [page.source, page]));
export const generatedPageByRoute = new Map(generatedPages.map((page) => [page.route, page]));

export const navItems = [
  { text: '首页', link: '/' },
  ...sections.map((section) => ({ text: section.text, link: `/${section.key}/` })),
  { text: 'GitHub', link: repoUrl }
];

export const sidebar = Object.fromEntries(
  sections.map((section) => [
    `/${section.key}/`,
    [
      {
        text: section.text,
        items: [
          {
            text: `${section.text}概览`,
            link: `/${section.key}/`
          },
          ...section.pages.map((page) => ({
            text: page.title,
            link: makeRouteFromTarget(page.target)
          }))
        ]
      }
    ]
  ])
);
