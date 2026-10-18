import compression from 'vite-plugin-compression';
import type { PluginOption } from 'vite';

export default (env: Record<string, string>) => {
  const { VITE_BUILD_COMPRESS } = env;
  const plugin: PluginOption[] = [];
  if (VITE_BUILD_COMPRESS) {
    const compressList = VITE_BUILD_COMPRESS.split(',');
    if (compressList.includes('gzip')) {
      // 使用gzip解压缩静态文件
      plugin.push(
        compression({
          ext: '.gz',
          deleteOriginFile: false
        })
      );
    }
    if (compressList.includes('brotli')) {
      plugin.push(
        compression({
          ext: '.br',
          algorithm: 'brotliCompress',
          deleteOriginFile: false
        })
      );
    }
  }
  return plugin;
};
