// https://umijs.org/config/

import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {defineConfig} from '@umijs/max';

import routes from './routes';

const parseEnvValue = (value: string) => {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

const loadEnvFile = (fileName: string) => {
  const filePath = join(__dirname, '..', fileName);
  if (!existsSync(filePath)) {
    return;
  }

  for (const line of readFileSync(filePath, 'utf-8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
    if (!match) {
      continue;
    }
    const [, key, value] = match;
    if (process.env[key] === undefined) {
      process.env[key] = parseEnvValue(value);
    }
  }
};

const getEnvFileName = () => {
  if (process.env.NODE_ENV === 'production' || process.env.UMI_ENV === 'prod') {
    return '.env.production';
  }
  if (!process.env.UMI_ENV || process.env.UMI_ENV === 'dev') {
    return '.env.development';
  }
  return `.env.${process.env.UMI_ENV}`;
};

loadEnvFile(getEnvFileName());

const defaultSettings = require('./defaultSettings').default;
const proxy = require('./proxy').default;

const { UMI_ENV = 'dev' } = process.env;
const APP_TITLE =
  process.env.VITE_APP_TITLE || 'infoq-scaffold-backend 后台管理系统';
const APP_LOGO_TITLE =
  process.env.VITE_APP_LOGO_TITLE || 'infoq-scaffold-backend';
const APP_BASE_API =
  process.env.VITE_APP_BASE_API ||
  (process.env.NODE_ENV === 'production' ? '/prod-api' : '/dev-api');
const APP_CONTEXT_PATH = process.env.VITE_APP_CONTEXT_PATH || '/';
const APP_PROXY_TARGET =
  process.env.VITE_APP_PROXY_TARGET ||
  (process.env.NODE_ENV === 'production'
    ? ''
    : proxy[UMI_ENV as keyof typeof proxy]?.[APP_BASE_API]?.target || '');
const PUBLIC_PATH = APP_CONTEXT_PATH.endsWith('/')
  ? APP_CONTEXT_PATH
  : `${APP_CONTEXT_PATH}/`;
const APP_PORT = process.env.VITE_APP_PORT || '80';
const APP_ENCRYPT = process.env.VITE_APP_ENCRYPT || 'true';
const APP_RSA_PUBLIC_KEY = process.env.VITE_APP_RSA_PUBLIC_KEY || '';
const APP_RSA_PRIVATE_KEY = process.env.VITE_APP_RSA_PRIVATE_KEY || '';
process.env.PORT = process.env.PORT || APP_PORT;

if (APP_ENCRYPT === 'true' && (!APP_RSA_PUBLIC_KEY || !APP_RSA_PRIVATE_KEY)) {
  throw new Error(
    'VITE_APP_RSA_PUBLIC_KEY and VITE_APP_RSA_PRIVATE_KEY are required when VITE_APP_ENCRYPT=true',
  );
}

// Compute commit hash: env vars take precedence, fall back to git at build time
const commitHash =
  process.env.COMMIT_HASH ||
  process.env.CF_PAGES_COMMIT_SHA ||
  (() => {
    try {
      return require('node:child_process')
        .execSync('git rev-parse HEAD', {
          stdio: ['ignore', 'pipe', 'ignore'],
          encoding: 'utf-8',
        })
        .trim();
    } catch {
      return '';
    }
  })();

export default defineConfig({
  alias: {
    '@root': join(__dirname, '..'),
  },
  /**
   * @name 开启 hash 模式
   * @description 让 build 之后的产物包含 hash 后缀。通常用于增量发布和避免浏览器加载缓存。
   * @doc https://umijs.org/docs/api/config#hash
   */
  hash: true,
  esbuildMinifyIIFE: true,

  base: PUBLIC_PATH,
  publicPath: PUBLIC_PATH,

  /**
   * @name 兼容性设置
   * @description 设置 ie11 不一定完美兼容，需要检查自己使用的所有依赖
   * @doc https://umijs.org/docs/api/config#targets
   */
  // targets: {
  //   ie: 11,
  // },
  /**
   * @name 路由的配置，不在路由中引入的文件不会编译
   * @description 只支持 path，component，routes，redirect，wrappers，title 的配置
   * @doc https://umijs.org/docs/guides/routes
   */
  // umi routes: https://umijs.org/docs/routing
  routes,
  /**
   * @name 主题的配置
   * @description 虽然叫主题，但是其实只是 less 的变量设置
   * @doc antd的主题设置 https://ant.design/docs/react/customize-theme-cn
   * @doc umi 的 theme 配置 https://umijs.org/docs/api/config#theme
   */
  // theme: { '@primary-color': '#1DA57A' }
  /**
   * @name moment 的国际化配置
   * @description 如果对国际化没有要求，打开之后能减少js的包大小
   * @doc https://umijs.org/docs/api/config#ignoremomentlocale
   */
  ignoreMomentLocale: true,
  /**
   * @name 代理配置
   * @description 可以让你的本地服务器代理到你的服务器上，这样你就可以访问服务器的数据了
   * @see 要注意以下 代理只能在本地开发时使用，build 之后就无法使用了。
   * @doc 代理介绍 https://umijs.org/docs/guides/proxy
   * @doc 代理配置 https://umijs.org/docs/api/config#proxy
   */
  proxy: proxy[UMI_ENV as keyof typeof proxy],
  /**
   * @name 快速热更新配置
   * @description 一个不错的热更新组件，更新时可以保留 state
   */
  fastRefresh: true,
  //============== 以下都是max的插件配置 ===============
  /**
   * @name 数据流插件
   * @@doc https://umijs.org/docs/max/data-flow
   */
  model: {},
  /**
   * 一个全局的初始数据流，可以用它在插件之间共享数据
   * @description 可以用来存放一些全局的数据，比如用户信息，或者一些全局的状态，全局初始状态在整个 Umi 项目的最开始创建。
   * @doc https://umijs.org/docs/max/data-flow#%E5%85%A8%E5%B1%80%E5%88%9D%E5%A7%8B%E7%8A%B6%E6%80%81
   */
  initialState: {},
  /**
   * @name layout 插件
   * @doc https://umijs.org/docs/max/layout-menu
   */
  title: APP_TITLE,
  layout: {
    locale: false,
    ...defaultSettings,
  },
  /**
   * @name moment2dayjs 插件
   * @description 将项目中的 moment 替换为 dayjs
   * @doc https://umijs.org/docs/max/moment2dayjs
   */
  moment2dayjs: {
    preset: 'antd',
    plugins: ['duration', 'relativeTime'],
  },
  /**
   * @name antd 插件
   * @description 内置了 babel import 插件
   * @doc https://umijs.org/docs/max/antd#antd
   */
  antd: {
    appConfig: {},
    configProvider: {
      variant: 'filled',
      theme: {
        token: {
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif",
        },
      },
    },
  },
  /**
   * @name 网络请求配置
   * @description 它基于 axios 和 ahooks 的 useRequest 提供了一套统一的网络请求和错误处理方案。
   * @doc https://umijs.org/docs/max/request
   */
  request: {},
  /**
   * @name 权限插件
   * @description 基于 initialState 的权限插件，必须先打开 initialState
   * @doc https://umijs.org/docs/max/access
   */
  access: {},
  /**
   * @name <head> 中额外的 script
   * @description 配置 <head> 中额外的 script
   */
  headScripts: [
    // 解决首次加载时白屏的问题
    { src: join(PUBLIC_PATH, 'scripts/loading.js'), async: true },
  ],

  define: {
    'process.env.CI': process.env.CI,
    'process.env.COMMIT_HASH': commitHash,
    'process.env.VITE_APP_TITLE': APP_TITLE,
    'process.env.VITE_APP_LOGO_TITLE': APP_LOGO_TITLE,
    'process.env.VITE_APP_BASE_API': APP_BASE_API,
    'process.env.VITE_APP_PROXY_TARGET': APP_PROXY_TARGET,
    'process.env.VITE_APP_CONTEXT_PATH': PUBLIC_PATH,
    'process.env.VITE_APP_CLIENT_ID':
      process.env.VITE_APP_CLIENT_ID || 'e5cd7e4891bf95d1d19206ce24a7b32e',
    'process.env.VITE_APP_ENCRYPT': APP_ENCRYPT,
    'process.env.VITE_APP_RSA_PUBLIC_KEY': APP_RSA_PUBLIC_KEY,
    'process.env.VITE_APP_RSA_PRIVATE_KEY': APP_RSA_PRIVATE_KEY,
    'process.env.VITE_APP_WEBSOCKET': process.env.VITE_APP_WEBSOCKET || 'false',
    'process.env.VITE_APP_SSE': process.env.VITE_APP_SSE || 'true',
    'import.meta.env.VITE_APP_TITLE': APP_TITLE,
    'import.meta.env.VITE_APP_LOGO_TITLE': APP_LOGO_TITLE,
    'import.meta.env.VITE_APP_BASE_API': APP_BASE_API,
    'import.meta.env.VITE_APP_PROXY_TARGET': APP_PROXY_TARGET,
    'import.meta.env.VITE_APP_CONTEXT_PATH': PUBLIC_PATH,
    'import.meta.env.VITE_APP_CLIENT_ID':
      process.env.VITE_APP_CLIENT_ID || 'e5cd7e4891bf95d1d19206ce24a7b32e',
    'import.meta.env.VITE_APP_ENCRYPT': APP_ENCRYPT,
    'import.meta.env.VITE_APP_RSA_PUBLIC_KEY': APP_RSA_PUBLIC_KEY,
    'import.meta.env.VITE_APP_RSA_PRIVATE_KEY': APP_RSA_PRIVATE_KEY,
    'import.meta.env.VITE_APP_WEBSOCKET': process.env.VITE_APP_WEBSOCKET || 'false',
    'import.meta.env.VITE_APP_SSE': process.env.VITE_APP_SSE || 'true',
    __APP_VERSION__: require('./../package.json').version,
    __UMI_VERSION__: require('@umijs/max/package.json').version,
    __UTOO_VERSION__: require('@utoo/pack/package.json').version,
  },
});
