import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * 如果是后端Docker部署，前端填写后端Docker名称加端口
 * 例如：'http://backend:8080'
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxyTarget = env.VITE_APP_PROXY_TARGET || 'http://localhost:8080';

  const reactVendorPackages = [
    'react',
    'react-dom',
    'react-router-dom',
    'scheduler',
    '@remix-run/router',
    '@babel/runtime',
    'tslib',
    'i18next',
    'react-i18next'
  ];
  const mediaVendorPackages = ['react-easy-crop'];
  const sharedVendorPackages = [
    'axios',
    'crypto-js',
    'dayjs',
    'file-saver',
    'jsencrypt',
    'nprogress',
    'zustand'
  ];
  const echartsVendorPackages = ['echarts'];
  const antdChunkGroups = [
    {
      chunk: 'vendor-antd-infra',
      packages: [
        '@ant-design/colors',
        '@ant-design/fast-color',
        '@ant-design/cssinjs',
        '@ant-design/cssinjs-utils',
        '@ant-design/icons',
        '@ant-design/icons-svg',
        '@rc-component/util',
        '@rc-component/overflow',
        '@rc-component/portal',
        '@rc-component/resize-observer'
      ]
    },
    {
      chunk: 'vendor-rc-table',
      packages: ['rc-table', 'rc-pagination']
    },
    {
      chunk: 'vendor-rc-picker',
      packages: ['rc-picker', '@rc-component/picker']
    },
    {
      chunk: 'vendor-rc-form',
      packages: [
        'rc-field-form',
        'rc-checkbox',
        'rc-input',
        'rc-input-number',
        'rc-radio',
        'rc-rate',
        'rc-select',
        'rc-slider',
        'rc-switch',
        'rc-textarea',
        'rc-upload',
        'rc-mentions'
      ]
    },
    {
      chunk: 'vendor-rc-tree',
      packages: ['rc-tree', 'rc-tree-select', 'rc-cascader', 'rc-virtual-list']
    },
    {
      chunk: 'vendor-rc-overlay',
      packages: [
        'rc-dialog',
        'rc-drawer',
        'rc-motion',
        'rc-notification',
        'rc-dropdown',
        'rc-menu',
        'rc-tooltip',
        '@rc-component/motion',
        '@rc-component/trigger'
      ]
    }
  ] as const;

  const matchesNodeModulePackage = (id: string, packages: readonly string[]) => {
    return packages.some((pkg) => id.includes(`/node_modules/${pkg}/`) || id.includes(`/node_modules/${pkg}`));
  };

  const getAntdChunkName = (id: string) => {
    for (const group of antdChunkGroups) {
      if (matchesNodeModulePackage(id, group.packages)) {
        return group.chunk;
      }
    }

    return undefined;
  };

  return {
    base: env.VITE_APP_CONTEXT_PATH || '/',
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
      }
    },
    server: {
      host: '0.0.0.0',
      port: Number(env.VITE_APP_PORT || 80),
      open: true,
      proxy: {
        [env.VITE_APP_BASE_API]: {
          target: proxyTarget,
          changeOrigin: true,
          ws: true,
          rewrite: (urlPath) => urlPath.replace(new RegExp('^' + env.VITE_APP_BASE_API), '')
        }
      }
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) {
              return;
            }
            if (id.includes('/node_modules/echarts/lib/chart/')) {
              return 'vendor-echarts-charts';
            }
            if (id.includes('/node_modules/echarts/lib/component/')) {
              return 'vendor-echarts-components';
            }
            if (id.includes('/node_modules/echarts/lib/coord/') || id.includes('/node_modules/echarts/lib/data/') || id.includes('/node_modules/echarts/lib/model/')) {
              return 'vendor-echarts-core';
            }
            if (matchesNodeModulePackage(id, echartsVendorPackages) || id.includes('/node_modules/zrender/')) {
              return 'vendor-echarts-render';
            }
            if (matchesNodeModulePackage(id, reactVendorPackages)) {
              return 'vendor-react';
            }
            if (matchesNodeModulePackage(id, mediaVendorPackages)) {
              return 'vendor-media';
            }
            if (matchesNodeModulePackage(id, sharedVendorPackages)) {
              return 'vendor-shared';
            }
            const antdChunkName = getAntdChunkName(id);
            if (antdChunkName) {
              return antdChunkName;
            }
          }
        }
      }
    },
    test: {
      name: 'infoq-scaffold-frontend-react-unit',
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./tests/setup.ts'],
      // Ant Design-heavy jsdom cases become flaky under worker contention.
      maxWorkers: 1,
      include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
      exclude: ['node_modules', 'dist', 'coverage'],
      mockReset: true,
      clearMocks: true,
      restoreMocks: true,
      css: false,
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html', 'lcov'],
        reportsDirectory: './coverage',
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['src/main.tsx', 'src/types/**/*.d.ts'],
        thresholds: {
          lines: 45,
          functions: 38,
          branches: 44,
          statements: 46
        }
      }
    }
  };
});
