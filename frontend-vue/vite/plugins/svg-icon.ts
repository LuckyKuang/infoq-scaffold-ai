import { createSvgIconsPlugin } from 'vite-plugin-svg-icons-ng';

interface PathResolver {
  resolve: (...paths: string[]) => string;
}

export default (path: PathResolver) => {
  return createSvgIconsPlugin({
    // 指定需要缓存的图标文件夹
    iconDirs: [path.resolve(path.resolve(__dirname, '../../src'), 'assets/icons/svg')],
    // 指定symbolId格式
    symbolId: 'icon-[dir]-[name]'
  });
};
