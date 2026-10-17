import vue from '@vitejs/plugin-vue';
import vueDevTools from 'vite-plugin-vue-devtools';

import createUnoCss from './unocss';
import createAutoImport from './auto-import';
import createComponents from './components';
import createIcons from './icons';
import createSvgIconsPlugin from './svg-icon';
import createCompression from './compression';
import createSetupExtend from './setup-extend';
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
