import vue from '@vitejs/plugin-vue';
import vueDevTools from 'vite-plugin-vue-devtools';

import createUnoCss from './unocss.ts';
import createAutoImport from './auto-import.ts';
import createComponents from './components.ts';
import createIcons from './icons.ts';
import createSvgIconsPlugin from './svg-icon.ts';
import createCompression from './compression.ts';
import createSetupExtend from './setup-extend.ts';
import path from 'path';
import type { PluginOption } from 'vite';

export default (viteEnv: Record<string, string>, isBuild = false): PluginOption[] => {
  const vitePlugins: PluginOption[] = [];
  vitePlugins.push(vue());
  if (!isBuild && viteEnv.VITE_APP_ENABLE_VUE_DEVTOOLS === 'true') {
    vitePlugins.push(vueDevTools());
  }
  vitePlugins.push(createUnoCss());
  vitePlugins.push(createAutoImport(path));
  vitePlugins.push(createComponents(path));
  vitePlugins.push(createCompression(viteEnv));
  vitePlugins.push(createIcons());
  vitePlugins.push(createSvgIconsPlugin(path));
  vitePlugins.push(createSetupExtend());
  return vitePlugins;
};
