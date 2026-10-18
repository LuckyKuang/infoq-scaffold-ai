import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import AutoImport from 'unplugin-auto-import/vite';
import { sharedResolve, sharedScssPreprocessorOptions } from './vite/shared';

export default defineConfig(() => {
  return {
    css: {
      preprocessorOptions: {
        ...sharedScssPreprocessorOptions
      }
    },
    plugins: [
      vue(),
      AutoImport({
        imports: [
          'vue',
          'pinia',
          '@vueuse/core',
          'vue-router',
          {
            'element-plus/es': ['ElMessage', 'ElMessageBox', 'ElNotification', 'ElLoading']
          }
        ],
        dts: false
      })
    ],
    resolve: sharedResolve,
    test: {
      name: 'infoq-scaffold-frontend-vue-unit',
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./tests/setup.ts'],
      include: ['tests/**/*.test.ts'],
      exclude: ['node_modules', 'dist', 'coverage'],
      mockReset: true,
      clearMocks: true,
      restoreMocks: true,
      css: false,
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html', 'lcov'],
        reportsDirectory: './coverage',
        include: ['src/**/*.{ts,tsx,vue}'],
        exclude: ['src/main.ts', 'src/assets/**', 'src/types/**/*.d.ts', 'src/**/index.ts', 'src/router/routes.ts']
      }
    }
  };
});
