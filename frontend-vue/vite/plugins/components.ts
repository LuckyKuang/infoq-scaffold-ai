import Components from 'unplugin-vue-components/vite';
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers';
import IconsResolver from 'unplugin-icons/resolver';

interface PathResolver {
  resolve: (...paths: string[]) => string;
}

export default (path: PathResolver) => {
  return Components({
    resolvers: [
      // 自动导入 Element Plus 组件
      ElementPlusResolver(),
      // 自动注册图标组件
      IconsResolver({
        enabledCollections: ['ep']
      })
    ],
    dts: path.resolve(path.resolve(__dirname, '../../src'), 'types', 'components.d.ts')
  });
};
