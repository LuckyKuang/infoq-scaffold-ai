import { defineConfig, loadEnv } from 'vite';
import createPlugins from './vite/plugins';
import autoprefixer from 'autoprefixer'; // css自动添加兼容性前缀
import { sharedResolve, sharedScssPreprocessorOptions } from './vite/shared';

const vueEcosystemPackages = [
  'vue',
  'vue-router',
  'pinia',
  'vue-i18n',
  '@vueuse/core',
  '@vueuse/shared',
  '@intlify/core-base',
  '@intlify/message-compiler',
  '@intlify/shared',
  '@vue/shared',
  '@vue/runtime-core',
  '@vue/runtime-dom',
  '@vue/reactivity'
];

const elementPlusBasePackages = ['@element-plus/hooks', '@element-plus/utils', '@element-plus/constants', '@element-plus/directives'];
const elementPlusFormPackages = [
  'button',
  'checkbox',
  'checkbox-button',
  'checkbox-group',
  'color-picker',
  'form',
  'form-item',
  'input',
  'input-number',
  'option',
  'radio',
  'radio-button',
  'radio-group',
  'select',
  'switch',
  'upload'
];
const elementPlusDataPackages = [
  'avatar',
  'badge',
  'card',
  'col',
  'descriptions',
  'descriptions-item',
  'empty',
  'image',
  'link',
  'pagination',
  'popover',
  'progress',
  'row',
  'scrollbar',
  'table',
  'table-column',
  'tag',
  'tooltip',
  'tree',
  'tree-select'
];
const elementPlusPickerPackages = ['date-picker-panel', 'time-picker'];
const elementPlusOverlayPackages = ['collection', 'focus-trap', 'overlay', 'popper', 'roving-focus-group', 'scrollbar', 'tooltip'];
const elementPlusBasicPackages = [
  'autocomplete',
  'breadcrumb',
  'button',
  'collapse-transition',
  'color-picker-panel',
  'divider',
  'icon',
  'image-viewer',
  'text'
];
const elementPlusFeedbackPackages = [
  'alert',
  'config-provider',
  'date-picker',
  'dialog',
  'drawer',
  'dropdown',
  'dropdown-item',
  'dropdown-menu',
  'loading',
  'menu',
  'menu-item',
  'message',
  'message-box',
  'notification',
  'result',
  'sub-menu',
  'tab-pane',
  'tabs'
];

const elementPlusDependencyPackages = [
  '@ctrl/tinycolor',
  '@floating-ui/dom',
  '@floating-ui/core',
  '@floating-ui/utils',
  '@sxzz/popperjs-es',
  'async-validator',
  'dayjs',
  'lodash',
  'lodash-es',
  'lodash-unified',
  'memoize-one',
  'normalize-wheel-es'
];

function matchesNodeModulePackage(id: string, packages: string[]) {
  const normalizedId = id.replace(/\\/g, '/');
  return packages.some((pkg) => normalizedId.includes(`/node_modules/${pkg}/`));
}

function matchesElementPlusComponent(id: string, packages: string[]) {
  const normalizedId = id.replace(/\\/g, '/');
  return packages.some((pkg) => normalizedId.includes(`/node_modules/element-plus/es/components/${pkg}/`));
}

/**
 * 如果是后端Docker部署，前端填写后端Docker名称加端口
 * 'http://infoq-admin:9090',
 */
export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd());
  const proxyTarget = env.VITE_APP_PROXY_TARGET || 'http://localhost:8080';
  return {
    // 部署生产环境和开发环境下的URL。
    // 默认情况下，vite 会假设你的应用是被部署在一个域名的根路径上
    // 例如 https://www.baidu.com/。如果应用被部署在一个子路径上，你就需要用这个选项指定这个子路径。例如，如果你的应用被部署在 https://www.baidu.com/admin/，则设置 baseUrl 为 /admin/。
    base: env.VITE_APP_CONTEXT_PATH,
    resolve: sharedResolve,
    // https://cn.vitejs.dev/config/#resolve-extensions
    plugins: createPlugins(env, command === 'build'),
    server: {
      host: '0.0.0.0',
      port: Number(env.VITE_APP_PORT),
      open: true,
      proxy: {
        [env.VITE_APP_BASE_API]: {
          // 后端宿主机部署时可通过 VITE_APP_PROXY_TARGET 覆盖代理目标
          target: proxyTarget,
          changeOrigin: true,
          ws: true,
          rewrite: (path) => path.replace(new RegExp('^' + env.VITE_APP_BASE_API), '')
        }
      }
    },
    css: {
      preprocessorOptions: {
        ...sharedScssPreprocessorOptions
      },
      postcss: {
        plugins: [
          // 浏览器兼容性
          autoprefixer(),
          {
            postcssPlugin: 'internal:charset-removal',
            AtRule: {
              charset: (atRule) => {
                atRule.remove();
              }
            }
          }
        ]
      }
    },
    // 预编译
    optimizeDeps: {
      include: [
        'vue',
        'vue-router',
        'pinia',
        'axios',
        '@vueuse/core',
        'echarts',
        'vue-i18n',
        '@vueup/vue-quill',
        'image-conversion',
        'element-plus/es/components/**/css'
      ]
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) {
              return;
            }
            if (matchesNodeModulePackage(id, vueEcosystemPackages)) {
              return 'vendor-vue';
            }
            if (matchesNodeModulePackage(id, elementPlusBasePackages)) {
              return 'vendor-element-plus-base';
            }
            if (matchesElementPlusComponent(id, elementPlusFormPackages)) {
              return 'vendor-element-plus-form';
            }
            if (matchesElementPlusComponent(id, elementPlusDataPackages)) {
              return 'vendor-element-plus-data';
            }
            if (matchesElementPlusComponent(id, elementPlusPickerPackages)) {
              return 'vendor-element-plus-picker';
            }
            if (matchesElementPlusComponent(id, elementPlusOverlayPackages)) {
              return 'vendor-element-plus-overlay';
            }
            if (matchesElementPlusComponent(id, elementPlusBasicPackages)) {
              return 'vendor-element-plus-basic';
            }
            if (matchesElementPlusComponent(id, elementPlusFeedbackPackages) || id.includes('/node_modules/element-plus/es/directives/')) {
              return 'vendor-element-plus-feedback';
            }
            if (id.includes('/node_modules/element-plus/')) {
              return 'vendor-element-plus-core';
            }
            if (matchesNodeModulePackage(id, elementPlusDependencyPackages)) {
              return 'vendor-element-plus-deps';
            }
            if (id.includes('/node_modules/echarts/lib/chart/')) {
              return 'vendor-echarts-charts';
            }
            if (id.includes('/node_modules/echarts/lib/component/')) {
              return 'vendor-echarts-components';
            }
            if (
              id.includes('/node_modules/echarts/lib/coord/') ||
              id.includes('/node_modules/echarts/lib/data/') ||
              id.includes('/node_modules/echarts/lib/model/')
            ) {
              return 'vendor-echarts-core';
            }
            if (id.includes('/node_modules/echarts/') || id.includes('/node_modules/zrender/')) {
              return 'vendor-echarts-render';
            }
            if (id.includes('@vueup/vue-quill') || id.includes('/quill/')) {
              return 'vendor-quill';
            }
            if (id.includes('@element-plus/icons-vue')) {
              return 'vendor-element-plus-icons';
            }
            if (id.includes('@highlightjs') || id.includes('highlight.js')) {
              return 'vendor-highlight';
            }
            if (id.includes('axios')) {
              return 'vendor-axios';
            }
          }
        }
      }
    }
  };
});
